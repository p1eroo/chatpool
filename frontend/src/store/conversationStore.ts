import { create } from "zustand";
import { env } from "@/config/env";
import type { ChannelType, Contact, Conversation, ConversationStatus, Message } from "@/types";
import { useAgentStore } from "@/store/agentStore";
import { conversations as seedConversations, getMessages } from "@/data/mock";
import { useLabelStore } from "@/store/labelStore";
import { getCurrentAgentId } from "@/lib/authSession";
import { saveActiveConversation } from "@/lib/activeConversationSession";
import { resolveInboxFilter, saveInboxFilter } from "@/lib/inboxFilterSession";
import { inboxes as seedInboxes } from "@/data/mock";
import { isWhatsAppReplyWindowClosed } from "@/lib/whatsappReplyWindow";
import {
  nextOptimisticSortOrder,
  seedOptimisticSortOrder,
  syncOptimisticSortOrder,
} from "@/lib/optimisticMessageSort";
import { sortMessagesChronologically } from "@/lib/messageOrder";
import { pickLatestPreviewMessage, pickLatestPreviewFromMessages } from "@/lib/conversationPreview";
import {
  mergeConversationLastMessageAt,
  shouldMessageAffectConversationSort,
  sortConversations,
} from "@/lib/conversationSort";
import { isApiError } from "@/api/errors";
import { conversationApiService } from "@/services/conversationApiService";
import { contactApiService } from "@/services/contactApiService";
import { useUIStore } from "@/store/uiStore";

export type AssigneeFilter = "mine" | "unassigned" | "all";

export interface SendTemplateInput {
  templateId: string;
  templateName: string;
  content: string;
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isInboxViewActive: boolean;
  isAppDataBootstrapped: boolean;
  messages: Record<string, Message[]>;
  /** true cuando GET /messages cargó el historial completo de esa conversación */
  messagesLoadedFromApi: Record<string, boolean>;
  /** true mientras GET /messages está en curso para esa conversación */
  messagesLoading: Record<string, boolean>;
  templateWindowOverrides: Record<string, boolean>;
  filterStatus: string;
  filterAssignee: AssigneeFilter;
  filterInboxId: string | null;
  filterLabelId: string | null;

  setConversations: (conversations: Conversation[]) => void;
  setInboxViewActive: (active: boolean) => void;
  setAppDataBootstrapped: (ready: boolean) => void;
  applyRealtimeMessage: (message: Message, conversation: Conversation) => void;
  applyRealtimeMessageUpdate: (message: Message, conversationId: string) => void;
  applyRealtimeConversation: (conversation: Conversation) => void;
  sendTemplateMessage: (conversationId: string, input: SendTemplateInput) => Promise<boolean>;
  /** Solo selecciona el chat (panel + mensajes). Nunca marca leído. */
  selectConversation: (id: string | null) => void;
  /** Clic explícito del usuario: selecciona y marca leído si hay unread. */
  openConversation: (id: string) => void;
  clearActiveConversationSelection: () => void;
  setFilterStatus: (status: string) => void;
  setFilterAssignee: (assignee: AssigneeFilter) => void;
  setFilterInboxId: (inboxId: string) => void;
  setFilterLabelId: (labelId: string | null) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    isPrivate: boolean,
    options?: {
      attachedToMessageId?: string;
      replyToMessageId?: string;
      contentType?: Message["contentType"];
      audioUrl?: string;
      audioDuration?: number;
      fileName?: string;
      fileSize?: number;
      fileUrl?: string;
      file?: File;
    }
  ) => void;
  createConversation: (
    contact: Contact,
    inboxId: string,
    channelType: ChannelType,
    initialMessage?: string
  ) => string;
  resolveConversation: (id: string) => Promise<boolean>;
  reopenConversation: (id: string) => Promise<boolean>;
  setConversationStatus: (id: string, status: ConversationStatus) => Promise<boolean>;
  reassignConversation: (id: string, agentId: string | undefined) => Promise<boolean>;
  markAsUnread: (id: string) => void;
  toggleConversationLabel: (id: string, labelId: string) => Promise<boolean>;
  deleteConversation: (id: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  blockContact: (conversationId: string) => Promise<boolean>;
  getFilteredConversations: () => Conversation[];
  getActiveConversation: () => Conversation | null;
  getActiveMessages: () => Message[];
  getTotalUnread: () => number;
}

function mergeConversationOnRealtimeMessage(
  existing: Conversation,
  incoming: Conversation,
  message: Message,
  isNewMessage: boolean
): Conversation {
  const lastMessage = pickLatestPreviewMessage(
    existing.lastMessage,
    incoming.lastMessage,
    isNewMessage ? message : null
  );

  return {
    ...incoming,
    lastMessage,
    lastMessageAt: mergeConversationLastMessageAt(
      existing,
      incoming,
      isNewMessage ? message : null
    ),
    updatedAt: new Date(
      Math.max(new Date(existing.updatedAt).getTime(), new Date(incoming.updatedAt).getTime())
    ),
  };
}

function mergeConversationOnRealtimeUpdate(
  existing: Conversation,
  incoming: Conversation
): Conversation {
  return {
    ...incoming,
    lastMessage: pickLatestPreviewMessage(existing.lastMessage, incoming.lastMessage),
    lastMessageAt: mergeConversationLastMessageAt(existing, incoming),
    updatedAt: new Date(
      Math.max(new Date(existing.updatedAt).getTime(), new Date(incoming.updatedAt).getTime())
    ),
  };
}

function getCurrentActorName(): string {
  return useAgentStore.getState().getAgentById(getCurrentAgentId() ?? "")?.name ?? "Agente";
}

function appendSystemActivityMessage(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  get: () => ConversationState,
  conversationId: string,
  content: string
) {
  appendMessageToState(set, get, conversationId, {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    content,
    senderType: "system",
    isPrivate: false,
    contentType: "text",
    createdAt: new Date(),
    status: "sent",
  }, false);
}

const PENDING_ACTIVITY_PREFIX = "pending-activity-";

function createPendingActivityMessageId(): string {
  return `${PENDING_ACTIVITY_PREFIX}${crypto.randomUUID()}`;
}

function isPendingActivityMessageId(id: string): boolean {
  return id.startsWith(PENDING_ACTIVITY_PREFIX);
}

function appendOptimisticActivityIfChatOpen(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  get: () => ConversationState,
  conversationId: string,
  content: string
): string | null {
  if (get().activeConversationId !== conversationId) return null;

  if (env.useMock) {
    appendSystemActivityMessage(set, get, conversationId, content);
    return null;
  }

  const pendingId = createPendingActivityMessageId();
  appendMessageToState(
    set,
    get,
    conversationId,
    {
      id: pendingId,
      conversationId,
      content,
      senderType: "system",
      isPrivate: false,
      contentType: "text",
      createdAt: new Date(),
      status: "sent",
    },
    false
  );
  return pendingId;
}

function removePendingActivityMessage(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  conversationId: string,
  pendingId: string | null
) {
  if (!pendingId) return;

  set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: (state.messages[conversationId] ?? []).filter(
        (message) => message.id !== pendingId
      ),
    },
  }));
}

function findPendingActivityReplaceIndex(messages: Message[], incoming: Message): number {
  if (incoming.senderType !== "system") return -1;

  return messages.findIndex(
    (item) =>
      isPendingActivityMessageId(item.id) &&
      item.senderType === "system" &&
      item.content === incoming.content
  );
}

async function reconcileActivityAfterApi(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  get: () => ConversationState,
  conversationId: string,
  pendingId: string | null
): Promise<void> {
  if (env.useMock || !pendingId || get().activeConversationId !== conversationId) return;

  try {
    const msgs = await conversationApiService.getMessages(conversationId);
    const pendingContent = get()
      .messages[conversationId]?.find((message) => message.id === pendingId)?.content;
    const serverMsg = pendingContent
      ? msgs.find(
          (message) => message.senderType === "system" && message.content === pendingContent
        )
      : undefined;

    set((state) => {
      const existing = state.messages[conversationId] ?? [];
      let next: Message[];

      if (serverMsg) {
        const seen = new Set<string>();
        next = existing
          .map((message) => (message.id === pendingId ? serverMsg : message))
          .filter((message) => {
            if (seen.has(message.id)) return false;
            seen.add(message.id);
            return true;
          });
      } else {
        next = mergeMessagesById(
          msgs,
          existing.filter((message) => !isPendingActivityMessageId(message.id))
        );
      }

      next = sortMessagesChronologically(next);

      return {
        messages: { ...state.messages, [conversationId]: next },
        messagesLoadedFromApi: { ...state.messagesLoadedFromApi, [conversationId]: true },
      };
    });

    syncTemplateWindowOverride(set, get, conversationId, get().messages[conversationId] ?? []);
  } catch {
    // El WebSocket puede reconciliar el pending-activity más tarde.
  }
}

function appendMessageToState(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  get: () => ConversationState,
  conversationId: string,
  newMessage: Message,
  isPrivate: boolean,
  attachedToMessageId?: string
) {
  const convMessages = get().messages[conversationId] || [];

  if (convMessages.some((item) => item.id === newMessage.id)) {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: convMessages.map((item) =>
          item.id === newMessage.id ? { ...item, ...newMessage } : item
        ),
      },
    }));
    return;
  }

  let updatedMessages: Message[];

  if (isPrivate && attachedToMessageId) {
    const attachIndex = convMessages.findIndex((m) => m.id === attachedToMessageId);
    if (attachIndex >= 0) {
      updatedMessages = [...convMessages];
      updatedMessages.splice(attachIndex, 0, newMessage);
    } else {
      updatedMessages = [...convMessages, newMessage];
    }
  } else {
    updatedMessages = sortMessagesChronologically([...convMessages, newMessage]);
  }

  const appendedToEnd = updatedMessages[updatedMessages.length - 1]?.id === newMessage.id;

  const affectsSort = shouldMessageAffectConversationSort(newMessage);

  set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: updatedMessages,
    },
    conversations: sortConversations(
      state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: pickLatestPreviewMessage(
                appendedToEnd ? newMessage : null,
                c.lastMessage
              ),
              lastMessageAt:
                affectsSort && appendedToEnd
                  ? newMessage.createdAt
                  : c.lastMessageAt,
              updatedAt: new Date(),
            }
          : c
      )
    ),
  }));
}

function syncTemplateWindowOverride(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  get: () => ConversationState,
  conversationId: string,
  messages: Message[]
) {
  const conversation = get().conversations.find((item) => item.id === conversationId);
  if (!conversation || !get().templateWindowOverrides[conversationId]) return;

  if (!isWhatsAppReplyWindowClosed(conversation.channelType, messages)) {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.templateWindowOverrides;
      return { templateWindowOverrides: rest };
    });
  }
}

function mergeMessagesById(primary: Message[], secondary: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const message of primary) byId.set(message.id, message);
  for (const message of secondary) {
    if (!byId.has(message.id)) byId.set(message.id, message);
  }
  return sortMessagesChronologically([...byId.values()]);
}

const PENDING_MESSAGE_PREFIX = "pending-";

function createPendingMessageId(): string {
  return `${PENDING_MESSAGE_PREFIX}${crypto.randomUUID()}`;
}

function isPendingMessageId(id: string): boolean {
  return id.startsWith(PENDING_MESSAGE_PREFIX);
}

function findPendingOutgoingReplaceIndex(messages: Message[], incoming: Message): number {
  if (incoming.senderType !== "agent") return -1;

  return messages.findIndex(
    (item) =>
      isPendingMessageId(item.id) &&
      item.senderType === "agent" &&
      item.senderId === incoming.senderId &&
      item.content === incoming.content &&
      item.isPrivate === incoming.isPrivate &&
      item.contentType === incoming.contentType
  );
}

function reconcileOutgoingMessage(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  get: () => ConversationState,
  conversationId: string,
  pendingId: string,
  apiMessage: Message
) {
  set((state) => {
    const current = state.messages[conversationId] ?? [];
    const pendingIndex = current.findIndex((item) => item.id === pendingId);
    const hasServerMessage = current.some((item) => item.id === apiMessage.id);

    let next: Message[];
    if (pendingIndex >= 0) {
      next = [...current];
      next[pendingIndex] = apiMessage;
    } else if (hasServerMessage) {
      next = current.map((item) => (item.id === apiMessage.id ? apiMessage : item));
    } else {
      next = [...current, apiMessage];
    }

    next = sortMessagesChronologically(next);
    const latest = next[next.length - 1] ?? null;

    return {
      messages: { ...state.messages, [conversationId]: next },
      conversations: sortConversations(
        state.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                lastMessage: pickLatestPreviewMessage(conversation.lastMessage, latest),
                lastMessageAt:
                  latest && shouldMessageAffectConversationSort(latest)
                    ? latest.createdAt
                    : conversation.lastMessageAt,
                updatedAt: new Date(),
              }
            : conversation
        )
      ),
    };
  });

  syncTemplateWindowOverride(set, get, conversationId, get().messages[conversationId] ?? []);
  syncOptimisticSortOrder(conversationId, apiMessage.sortOrder);
}

function removePendingMessage(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  conversationId: string,
  pendingId: string
) {
  set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: (state.messages[conversationId] ?? []).filter(
        (item) => item.id !== pendingId
      ),
    },
  }));
}

function getInitialInboxFilter(): string | null {
  if (!env.useMock) return null;

  const agentId = getCurrentAgentId();
  const inboxIds = seedInboxes.map((inbox) => inbox.id);
  if (!agentId) return inboxIds[0] ?? null;

  return resolveInboxFilter(agentId, inboxIds);
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: env.useMock ? seedConversations : [],
  activeConversationId: null,
  isInboxViewActive: false,
  isAppDataBootstrapped: false,
  messages: {},
  messagesLoadedFromApi: {},
  messagesLoading: {},
  templateWindowOverrides: {},
  filterStatus: "open",
  filterAssignee: "mine",
  filterInboxId: getInitialInboxFilter(),
  filterLabelId: null,

  setConversations: (conversations) =>
    set({
      conversations: sortConversations(conversations),
    }),

  setInboxViewActive: (active) => set({ isInboxViewActive: active }),

  setAppDataBootstrapped: (ready) => set({ isAppDataBootstrapped: ready }),

  applyRealtimeMessage: (message, conversation) => {
    set((currentState) => {
      const existingMessages = currentState.messages[conversation.id] ?? [];
      const hasMessage = existingMessages.some((item) => item.id === message.id);
      const existingConversation = currentState.conversations.find(
        (item) => item.id === conversation.id
      );
      const hasConversation = Boolean(existingConversation);

      const mergedConversation = existingConversation
        ? mergeConversationOnRealtimeMessage(
            existingConversation,
            conversation,
            message,
            !hasMessage
          )
        : {
            ...conversation,
            lastMessage: pickLatestPreviewMessage(conversation.lastMessage, message),
          };

      const conversations = sortConversations(
        hasConversation
          ? currentState.conversations.map((item) =>
              item.id === mergedConversation.id ? mergedConversation : item
            )
          : [mergedConversation, ...currentState.conversations]
      );

      if (hasMessage) {
        return {
          conversations,
          messages: {
            ...currentState.messages,
            [conversation.id]: sortMessagesChronologically(
              existingMessages.map((item) =>
                item.id === message.id ? { ...item, ...message } : item
              )
            ),
          },
        };
      }

      const outgoingPendingIndex = findPendingOutgoingReplaceIndex(
        existingMessages,
        message
      );
      const pendingIndex =
        outgoingPendingIndex >= 0
          ? outgoingPendingIndex
          : findPendingActivityReplaceIndex(existingMessages, message);
      let nextMessages: Message[];

      if (pendingIndex >= 0) {
        nextMessages = [...existingMessages];
        nextMessages[pendingIndex] = message;
        nextMessages = sortMessagesChronologically(nextMessages);
      } else {
        nextMessages = sortMessagesChronologically([...existingMessages, message]);
      }

      return {
        conversations,
        messages: {
          ...currentState.messages,
          [conversation.id]: nextMessages,
        },
      };
    });

    syncOptimisticSortOrder(conversation.id, message.sortOrder);
    syncTemplateWindowOverride(set, get, conversation.id, get().messages[conversation.id] ?? []);
  },

  applyRealtimeMessageUpdate: (message, conversationId) => {
    set((state) => {
      const existingMessages = state.messages[conversationId] ?? [];
      const hasMessage = existingMessages.some((item) => item.id === message.id);
      if (!hasMessage) return state;

      return {
        messages: {
          ...state.messages,
          [conversationId]: existingMessages.map((item) =>
            item.id === message.id ? message : item
          ),
        },
      };
    });
  },

  applyRealtimeConversation: (conversation) => {
    set((state) => {
      const existingConversation = state.conversations.find(
        (item) => item.id === conversation.id
      );
      const hasConversation = Boolean(existingConversation);
      const mergedConversation = existingConversation
        ? mergeConversationOnRealtimeUpdate(existingConversation, conversation)
        : conversation;

      const conversations = sortConversations(
        hasConversation
          ? state.conversations.map((item) =>
              item.id === mergedConversation.id ? mergedConversation : item
            )
          : [mergedConversation, ...state.conversations]
      );

      return { conversations };
    });
  },

  sendTemplateMessage: async (conversationId, input) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    if (!conversation || conversation.channelType !== "whatsapp") return false;

    try {
      let message: Message;

      if (env.useMock) {
        if (input.templateId === "demo_fail") return false;

        const currentAgent = useAgentStore.getState().getAgentById(getCurrentAgentId() ?? "");
        message = {
          id: `msg-${Date.now()}`,
          conversationId,
          content: input.content,
          senderType: "agent",
          senderId: currentAgent?.id,
          senderName: currentAgent?.name ?? "Agente",
          isPrivate: false,
          contentType: "text",
          createdAt: new Date(),
          status: "sent",
        };
      } else {
        message = await conversationApiService.sendTemplate(conversationId, input);
      }

      appendMessageToState(set, get, conversationId, message, false);

      set((state) => ({
        templateWindowOverrides: {
          ...state.templateWindowOverrides,
          [conversationId]: true,
        },
      }));

      return true;
    } catch {
      return false;
    }
  },

  selectConversation: (id) => {
    const agentId = getCurrentAgentId();

    if (!id) {
      if (agentId) saveActiveConversation(agentId, null);
      set({ activeConversationId: null });
      return;
    }

    if (agentId) saveActiveConversation(agentId, id);

    set({ activeConversationId: id });

    const state = get();

    if (env.useMock) {
      const hasMessages = Boolean(state.messages[id]);
      if (!hasMessages) {
        set((s) => ({
          messages: { ...s.messages, [id]: getMessages(id) },
        }));
      }
      const loaded = hasMessages ? state.messages[id] ?? [] : getMessages(id);
      syncTemplateWindowOverride(set, get, id, loaded);
      return;
    }

    if (state.messagesLoadedFromApi[id]) {
      syncTemplateWindowOverride(set, get, id, state.messages[id] ?? []);
      return;
    }

    set((s) => ({
      messagesLoading: { ...s.messagesLoading, [id]: true },
    }));

    void conversationApiService
      .getMessages(id)
      .then((msgs) => {
        set((s) => {
          const existing = s.messages[id] ?? [];
          const merged = mergeMessagesById(msgs, existing);
          seedOptimisticSortOrder(id, merged);
          return {
            messages: { ...s.messages, [id]: merged },
            messagesLoadedFromApi: { ...s.messagesLoadedFromApi, [id]: true },
            messagesLoading: { ...s.messagesLoading, [id]: false },
          };
        });
        syncTemplateWindowOverride(set, get, id, get().messages[id] ?? []);
      })
      .catch(() => {
        set((s) => ({
          messagesLoading: { ...s.messagesLoading, [id]: false },
        }));
      });
  },

  openConversation: (id) => {
    const unreadCount =
      get().conversations.find((conversation) => conversation.id === id)?.unreadCount ?? 0;

    get().selectConversation(id);

    if (env.useMock) {
      if (unreadCount > 0) {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, unreadCount: 0 } : c
          ),
        }));
      }
      return;
    }

    if (unreadCount <= 0) return;

    void conversationApiService.markRead(id, "user-open").then(() => {
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, unreadCount: 0 } : c
        ),
      }));
    });
  },

  clearActiveConversationSelection: () => set({ activeConversationId: null }),

  setFilterStatus: (status) => set({ filterStatus: status }),
  setFilterAssignee: (assignee) => set({ filterAssignee: assignee }),
  setFilterInboxId: (inboxId) => {
    const agentId = getCurrentAgentId();
    if (agentId) {
      saveInboxFilter(agentId, inboxId);
    }

    set({ filterInboxId: inboxId, filterLabelId: null });

    if (!env.useMock) {
      void conversationApiService
        .list({ inboxId, status: "all", assignee: "all" })
        .then((conversations) => get().setConversations(conversations))
        .catch(() => {});
    }
  },
  setFilterLabelId: (labelId) => set({ filterLabelId: labelId }),

  createConversation: (contact, inboxId, channelType, initialMessage) => {
    const id = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id,
      inboxId,
      contact,
      lastMessage: null,
      lastMessageAt: null,
      unreadCount: 0,
      status: "open",
      priority: "none",
      labels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isTyping: false,
      channelType,
    };

    set((state) => ({
      conversations: [newConv, ...state.conversations],
      activeConversationId: id,
      messages: { ...state.messages, [id]: [] },
    }));

    if (initialMessage?.trim()) {
      get().sendMessage(id, initialMessage.trim(), false);
    }

    return id;
  },

  sendMessage: (conversationId, content, isPrivate, options) => {
    const convMessages = get().messages[conversationId] || [];
    const conversation = get().conversations.find((item) => item.id === conversationId);

    if (
      !isPrivate &&
      isWhatsAppReplyWindowClosed(conversation?.channelType, convMessages, {
        templateUnlocked: get().templateWindowOverrides[conversationId],
      })
    ) {
      return;
    }

    const currentAgent = useAgentStore.getState().getAgentById(getCurrentAgentId() ?? "");
    const attachedToMessageId = options?.attachedToMessageId;
    const replyToMessageId = options?.replyToMessageId;

    const attachedMessage = attachedToMessageId
      ? convMessages.find((m) => m.id === attachedToMessageId)
      : undefined;

    const replyTarget = replyToMessageId
      ? convMessages.find((m) => m.id === replyToMessageId)
      : undefined;

    const existingAttachedNotes = attachedToMessageId
      ? convMessages.filter((m) => m.attachedToMessageId === attachedToMessageId).length
      : 0;

    const buildLocalMessage = (overrides?: Partial<Message>): Message => ({
      id: overrides?.id ?? `msg-${Date.now()}`,
      conversationId,
      content,
      senderType: "agent",
      senderId: currentAgent?.id ?? "unknown",
      senderName: currentAgent?.name ?? "Agente",
      isPrivate,
      attachedToMessageId: isPrivate && attachedToMessageId ? attachedToMessageId : undefined,
      replyTo:
        !isPrivate && replyTarget
          ? {
              id: replyTarget.id,
              content: replyTarget.content,
              senderName: replyTarget.senderName,
              senderType: replyTarget.senderType as "agent" | "contact" | "bot",
            }
          : undefined,
      contentType: options?.contentType || "text",
      audioUrl: options?.audioUrl,
      audioDuration: options?.audioDuration,
      fileName: options?.fileName,
      fileSize: options?.fileSize,
      fileUrl: options?.fileUrl,
      sortOrder: overrides?.sortOrder ?? nextOptimisticSortOrder(conversationId),
      createdAt:
        overrides?.createdAt ??
        (attachedMessage
          ? new Date(attachedMessage.createdAt.getTime() - (existingAttachedNotes + 1))
          : new Date()),
      status: overrides?.status ?? "sent",
    });

    if (!env.useMock) {
      const pendingId = createPendingMessageId();
      const optimistic = buildLocalMessage({ id: pendingId, status: "sent" });
      appendMessageToState(
        set,
        get,
        conversationId,
        optimistic,
        isPrivate,
        attachedToMessageId
      );

      const uploadFile = options?.file;
      const contentType = options?.contentType ?? "text";

      if (
        uploadFile &&
        (contentType === "image" || contentType === "file" || contentType === "audio")
      ) {
        void conversationApiService
          .sendMessageWithFile(
            conversationId,
            uploadFile,
            content,
            isPrivate,
            contentType,
            replyToMessageId
          )
          .then((apiMessage) => {
            reconcileOutgoingMessage(set, get, conversationId, pendingId, {
              ...apiMessage,
              replyTo: apiMessage.replyTo ?? optimistic.replyTo,
              attachedToMessageId: optimistic.attachedToMessageId,
              audioUrl: contentType === "audio" ? apiMessage.fileUrl : options?.audioUrl,
              audioDuration: options?.audioDuration,
            });
          })
          .catch((error) => {
            removePendingMessage(set, conversationId, pendingId);
            useUIStore.getState().showToast(
              isApiError(error) ? error.message : "No se pudo enviar el archivo"
            );
          });
        return;
      }

      void conversationApiService
        .sendMessage(conversationId, content, isPrivate, {
          contentType,
          replyToMessageId,
        })
        .then((apiMessage) => {
          reconcileOutgoingMessage(set, get, conversationId, pendingId, {
            ...apiMessage,
            replyTo: apiMessage.replyTo ?? optimistic.replyTo,
            attachedToMessageId: optimistic.attachedToMessageId,
            audioUrl: options?.audioUrl,
            audioDuration: options?.audioDuration,
          });
        })
        .catch((error) => {
          removePendingMessage(set, conversationId, pendingId);
          useUIStore.getState().showToast(
            isApiError(error) ? error.message : "No se pudo enviar el mensaje"
          );
        });
      return;
    }

    appendMessageToState(
      set,
      get,
      conversationId,
      buildLocalMessage(),
      isPrivate,
      attachedToMessageId
    );
  },

  resolveConversation: (id) => get().setConversationStatus(id, "resolved"),

  reopenConversation: (id) => get().setConversationStatus(id, "open"),

  setConversationStatus: async (id, status) => {
    const previous = get().conversations.find((c) => c.id === id);
    if (!previous) return false;

    const previousActiveId = get().activeConversationId;
    const actorName = getCurrentActorName();
    const isReopen = status === "open" && previous.status === "resolved";

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
      activeConversationId:
        status === "resolved" && state.activeConversationId === id
          ? null
          : state.activeConversationId,
    }));

    let pendingActivityId: string | null = null;

    if (env.useMock) {
      if (status === "resolved") {
        appendSystemActivityMessage(
          set,
          get,
          id,
          `La conversación fue marcada como resuelta por ${actorName}`
        );
      } else if (isReopen) {
        appendSystemActivityMessage(
          set,
          get,
          id,
          `La conversación fue reabierta por ${actorName}`
        );
      }
      return true;
    }

    if (isReopen) {
      pendingActivityId = appendOptimisticActivityIfChatOpen(
        set,
        get,
        id,
        `La conversación fue reabierta por ${actorName}`
      );
    }

    try {
      const updated = await conversationApiService.updateConversation(id, { status });
      set((state) => ({
        conversations: state.conversations.map((c) => (c.id === id ? updated : c)),
        ...(status === "resolved"
          ? { messagesLoadedFromApi: { ...state.messagesLoadedFromApi, [id]: false } }
          : {}),
      }));

      if (isReopen) {
        await reconcileActivityAfterApi(set, get, id, pendingActivityId);
      }

      return true;
    } catch {
      removePendingActivityMessage(set, id, pendingActivityId);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, status: previous.status } : c
        ),
        activeConversationId: previousActiveId,
      }));
      return false;
    }
  },

  reassignConversation: async (id, agentId) => {
    const previous = get().conversations.find((c) => c.id === id);
    const agent = useAgentStore.getState().agents.find((a) => a.id === agentId);
    const actorName = getCurrentActorName();

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, assignee: agent || undefined } : c
      ),
    }));

    let pendingActivityId: string | null = null;
    let activityContent: string | null = null;

    if (agentId) {
      activityContent = `La conversación fue asignada a ${agent?.name ?? "un agente"} por ${actorName}`;
    } else if (previous?.assignee) {
      activityContent = `La conversación fue desasignada por ${actorName}`;
    }

    if (activityContent) {
      pendingActivityId = appendOptimisticActivityIfChatOpen(
        set,
        get,
        id,
        activityContent
      );
    }

    if (env.useMock) return true;

    try {
      await conversationApiService.updateConversation(id, { assigneeId: agentId ?? null });
      await reconcileActivityAfterApi(set, get, id, pendingActivityId);
      return true;
    } catch {
      removePendingActivityMessage(set, id, pendingActivityId);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, assignee: previous?.assignee } : c
        ),
      }));
      return false;
    }
  },

  markAsUnread: (id) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, unreadCount: Math.max(c.unreadCount, 1) } : c
      ),
    }));

    if (!env.useMock) {
      void conversationApiService.updateConversation(id, { unreadCount: 1 }).catch(() => {});
    }
  },

  toggleConversationLabel: async (id, labelId) => {
    const conversation = get().conversations.find((c) => c.id === id);
    const label = useLabelStore.getState().labels.find((l) => l.id === labelId);
    if (!conversation || !label || label.inboxId !== conversation.inboxId) return false;

    const hasLabel = conversation.labels.some((l) => l.id === labelId);
    const optimisticLabels = hasLabel
      ? conversation.labels.filter((l) => l.id !== labelId)
      : [...conversation.labels, label];
    const actorName = getCurrentActorName();
    const activityContent = hasLabel
      ? `Se quitó la etiqueta "${label.name}" por ${actorName}`
      : `Se añadió la etiqueta "${label.name}" por ${actorName}`;

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, labels: optimisticLabels } : c
      ),
    }));

    const pendingActivityId = appendOptimisticActivityIfChatOpen(
      set,
      get,
      id,
      activityContent
    );

    if (env.useMock) return true;

    try {
      const updated = await conversationApiService.toggleLabel(id, labelId);
      set((state) => ({
        conversations: state.conversations.map((c) => (c.id === id ? updated : c)),
      }));
      await reconcileActivityAfterApi(set, get, id, pendingActivityId);
      return true;
    } catch {
      removePendingActivityMessage(set, id, pendingActivityId);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, labels: conversation.labels } : c
        ),
      }));
      return false;
    }
  },

  deleteConversation: (id) => {
    set((state) => {
      const { [id]: _, ...restMessages } = state.messages;
      const { [id]: __loaded, ...restLoaded } = state.messagesLoadedFromApi;
      const { [id]: __loading, ...restLoading } = state.messagesLoading;
      return {
        conversations: state.conversations.filter((c) => c.id !== id),
        messages: restMessages,
        messagesLoadedFromApi: restLoaded,
        messagesLoading: restLoading,
        activeConversationId:
          state.activeConversationId === id ? null : state.activeConversationId,
      };
    });

    if (!env.useMock) {
      void conversationApiService.deleteConversation(id).catch(() => {});
    }
  },

  deleteMessage: (conversationId, messageId) => {
    set((state) => {
      const convMessages = state.messages[conversationId] || [];
      const updatedMessages = convMessages.filter((m) => m.id !== messageId);
      const lastMessage = pickLatestPreviewFromMessages(updatedMessages);
      const lastMessageAt = lastMessage?.createdAt ?? null;

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
        conversations: sortConversations(
          state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage, lastMessageAt, updatedAt: new Date() }
              : c
          )
        ),
      };
    });

    if (!env.useMock) {
      void conversationApiService.deleteMessage(conversationId, messageId).catch(() => {});
    }
  },

  blockContact: async (conversationId) => {
    const conversation = get().conversations.find((c) => c.id === conversationId);
    if (!conversation) return false;

    const contactId = conversation.contact.id;
    const previous = conversation.contact.isBlocked === true;

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.contact.id === contactId
          ? { ...c, contact: { ...c.contact, isBlocked: true } }
          : c
      ),
    }));

    if (env.useMock) return true;

    try {
      await contactApiService.update(contactId, { isBlocked: true });
      return true;
    } catch {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.contact.id === contactId
            ? { ...c, contact: { ...c.contact, isBlocked: previous } }
            : c
        ),
      }));
      return false;
    }
  },

  getFilteredConversations: () => {
    const { conversations, filterStatus, filterAssignee, filterInboxId, filterLabelId } = get();
    let filtered = conversations;
    if (filterStatus !== "all") {
      filtered = filtered.filter((c) => c.status === filterStatus);
    }
    if (filterAssignee === "mine") {
      const agentId = getCurrentAgentId();
      filtered = filtered.filter((c) => agentId && c.assignee?.id === agentId);
    } else if (filterAssignee === "unassigned") {
      filtered = filtered.filter((c) => !c.assignee);
    }
    if (filterInboxId) {
      filtered = filtered.filter((c) => c.inboxId === filterInboxId);
    }
    if (filterLabelId) {
      filtered = filtered.filter((c) => c.labels.some((label) => label.id === filterLabelId));
    }
    return filtered;
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) || null;
  },

  getActiveMessages: () => {
    const { messages, activeConversationId } = get();
    return activeConversationId ? (messages[activeConversationId] || []) : [];
  },

  getTotalUnread: () => {
    return get().conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  },
}));
