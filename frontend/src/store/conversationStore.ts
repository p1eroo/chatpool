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
import { isApiError } from "@/api/errors";
import { conversationApiService } from "@/services/conversationApiService";
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
  setFilterInboxId: (inboxId: string | null) => void;
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
  resolveConversation: (id: string) => void;
  setConversationStatus: (id: string, status: ConversationStatus) => void;
  reassignConversation: (id: string, agentId: string | undefined) => void;
  markAsUnread: (id: string) => void;
  toggleConversationLabel: (id: string, labelId: string) => void;
  deleteConversation: (id: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  blockContact: (conversationId: string) => void;
  getFilteredConversations: () => Conversation[];
  getActiveConversation: () => Conversation | null;
  getActiveMessages: () => Message[];
  getTotalUnread: () => number;
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
}

function pickLatestMessage(
  ...candidates: Array<Message | null | undefined>
): Message | null {
  const items = candidates.filter((item): item is Message => Boolean(item));
  if (items.length === 0) return null;

  return items.reduce((latest, current) =>
    new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
  );
}

function mergeConversationOnRealtimeMessage(
  existing: Conversation,
  incoming: Conversation,
  message: Message,
  isNewMessage: boolean
): Conversation {
  const lastMessage = pickLatestMessage(
    existing.lastMessage,
    incoming.lastMessage,
    isNewMessage ? message : null
  );

  return {
    ...incoming,
    lastMessage,
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
    lastMessage: pickLatestMessage(existing.lastMessage, incoming.lastMessage),
    updatedAt: new Date(
      Math.max(new Date(existing.updatedAt).getTime(), new Date(incoming.updatedAt).getTime())
    ),
  };
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
    updatedMessages = [...convMessages, newMessage];
  }

  const appendedToEnd = updatedMessages[updatedMessages.length - 1]?.id === newMessage.id;

  set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: updatedMessages,
    },
    conversations: state.conversations.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            lastMessage: appendedToEnd ? newMessage : c.lastMessage,
            updatedAt: new Date(),
          }
        : c
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
            lastMessage: pickLatestMessage(conversation.lastMessage, message),
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
            [conversation.id]: existingMessages.map((item) =>
              item.id === message.id ? { ...item, ...message } : item
            ),
          },
        };
      }

      return {
        conversations,
        messages: {
          ...currentState.messages,
          [conversation.id]: [...existingMessages, message],
        },
      };
    });

    syncTemplateWindowOverride(set, get, conversation.id, [
      ...(get().messages[conversation.id] ?? []),
      message,
    ]);
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
    const hasMessages = Boolean(state.messages[id]);

    if (env.useMock) {
      if (!hasMessages) {
        set((s) => ({
          messages: { ...s.messages, [id]: getMessages(id) },
        }));
      }
      const loaded = hasMessages ? state.messages[id] ?? [] : getMessages(id);
      syncTemplateWindowOverride(set, get, id, loaded);
      return;
    }

    if (!hasMessages) {
      void conversationApiService.getMessages(id).then((msgs) => {
        set((s) => ({
          messages: { ...s.messages, [id]: msgs },
        }));
        syncTemplateWindowOverride(set, get, id, msgs);
      });
    } else {
      syncTemplateWindowOverride(set, get, id, state.messages[id] ?? []);
    }
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
      const { filterStatus, filterAssignee, filterLabelId } = get();
      void conversationApiService
        .list({
          inboxId,
          status: filterStatus,
          assignee: filterAssignee,
          labelId: filterLabelId,
        })
        .then((conversations) => set({ conversations }))
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
      createdAt:
        overrides?.createdAt ??
        (attachedMessage
          ? new Date(attachedMessage.createdAt.getTime() - (existingAttachedNotes + 1))
          : new Date()),
      status: overrides?.status ?? "sent",
    });

    if (!env.useMock) {
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
            const merged: Message = {
              ...apiMessage,
              replyTo: apiMessage.replyTo ?? buildLocalMessage().replyTo,
              attachedToMessageId: buildLocalMessage().attachedToMessageId,
              audioUrl:
                contentType === "audio" ? apiMessage.fileUrl : options?.audioUrl,
              audioDuration: options?.audioDuration,
            };
            appendMessageToState(set, get, conversationId, merged, isPrivate, attachedToMessageId);
          })
          .catch((error) => {
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
          const merged: Message = {
            ...apiMessage,
            replyTo: apiMessage.replyTo ?? buildLocalMessage().replyTo,
            attachedToMessageId: buildLocalMessage().attachedToMessageId,
            audioUrl: options?.audioUrl,
            audioDuration: options?.audioDuration,
          };
          appendMessageToState(set, get, conversationId, merged, isPrivate, attachedToMessageId);
        })
        .catch((error) => {
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

  resolveConversation: (id) => {
    get().setConversationStatus(id, "resolved");
  },

  setConversationStatus: (id, status) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
      activeConversationId:
        status === "resolved" && state.activeConversationId === id
          ? null
          : state.activeConversationId,
    }));

    if (!env.useMock) {
      void conversationApiService.updateConversation(id, { status }).catch(() => {});
    }
  },

  reassignConversation: (id, agentId) => {
    const agent = useAgentStore.getState().agents.find((a) => a.id === agentId);
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, assignee: agent || undefined } : c
      ),
    }));

    if (!env.useMock) {
      void conversationApiService
        .updateConversation(id, { assigneeId: agentId ?? null })
        .catch(() => {});
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

  toggleConversationLabel: (id, labelId) => {
    const conversation = get().conversations.find((c) => c.id === id);
    const label = useLabelStore.getState().labels.find((l) => l.id === labelId);
    if (!conversation || !label || label.inboxId !== conversation.inboxId) return;

    const hasLabel = conversation.labels.some((l) => l.id === labelId);
    const optimisticLabels = hasLabel
      ? conversation.labels.filter((l) => l.id !== labelId)
      : [...conversation.labels, label];

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, labels: optimisticLabels } : c
      ),
    }));

    if (!env.useMock) {
      void conversationApiService
        .toggleLabel(id, labelId)
        .then((updated) => {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? updated : c
            ),
          }));
        })
        .catch(() => {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, labels: conversation.labels } : c
            ),
          }));
        });
    }
  },

  deleteConversation: (id) => {
    set((state) => {
      const { [id]: _, ...restMessages } = state.messages;
      return {
        conversations: state.conversations.filter((c) => c.id !== id),
        messages: restMessages,
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
      const lastMessage =
        updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : null;

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage, updatedAt: new Date() }
            : c
        ),
      };
    });

    if (!env.useMock) {
      void conversationApiService.deleteMessage(conversationId, messageId).catch(() => {});
    }
  },

  blockContact: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, contact: { ...c.contact, isBlocked: true } }
          : c
      ),
    }));
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
