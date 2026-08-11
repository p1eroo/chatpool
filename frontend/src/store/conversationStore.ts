import { create } from "zustand";
import { env } from "@/config/env";
import type { ChannelType, Contact, Conversation, ConversationStatus, LinkPreview, Message, SavedSticker } from "@/types";
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
import { orderMessagesBySelection } from "@/lib/forwardMessages";
import { pickLatestPreviewMessage, pickLatestPreviewFromMessages } from "@/lib/conversationPreview";
import {
  mergeConversationLastMessageAt,
  shouldMessageAffectConversationSort,
  sortConversations,
} from "@/lib/conversationSort";
import { isApiError } from "@/api/errors";
import { conversationApiService } from "@/services/conversationApiService";
import { contactApiService } from "@/services/contactApiService";
import { stickerApiService } from "@/services/stickerApiService";
import { useUIStore } from "@/store/uiStore";
import { useInboxStore } from "@/store/inboxStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";

export type AssigneeFilter = "mine" | "unassigned" | "all";

export interface SendTemplateInput {
  templateId: string;
  templateName: string;
  language: string;
  content: string;
  bodyParameters?: string[];
  headerParameters?: string[];
  buttonUrlParameters?: Array<{ index: number; text: string }>;
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
  /** Bandeja a la que pertenece `conversations` (null = aún cargando / no sincronizar badge en vivo). */
  conversationsInboxId: string | null;
  filterLabelId: string | null;

  setConversations: (conversations: Conversation[]) => void;
  setInboxViewActive: (active: boolean) => void;
  setAppDataBootstrapped: (ready: boolean) => void;
  applyRealtimeMessage: (message: Message, conversation: Conversation) => void;
  applyRealtimeMessageUpdate: (message: Message, conversationId: string) => void;
  applyRealtimeConversation: (conversation: Conversation) => void;
  sendTemplateMessage: (conversationId: string, input: SendTemplateInput) => Promise<boolean>;
  retryFailedMessage: (conversationId: string, messageId: string) => Promise<boolean>;
  forwardMessages: (
    sourceConversationId: string,
    messageIds: string[],
    targetConversationIds: string[]
  ) => boolean;
  sendSavedSticker: (conversationId: string, sticker: SavedSticker) => Promise<boolean>;
  /** Solo selecciona el chat (panel + mensajes). Nunca marca leído. */
  selectConversation: (id: string | null) => void;
  /** Clic explícito del usuario: selecciona y marca leído si hay unread. */
  openConversation: (id: string) => void;
  /** Marca leída la conversación activa (p. ej. al volver a la pestaña). */
  acknowledgeConversationRead: (id: string, reason?: string) => void;
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
      linkPreview?: LinkPreview;
      suppressLinkPreview?: boolean;
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
  /** Quita una etiqueta eliminada de conversaciones cargadas y del filtro activo. */
  removeLabelFromAllConversations: (labelId: string) => void;
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
    labels: incoming.labels?.length ? incoming.labels : existing.labels,
    contact: incoming.contact ?? existing.contact,
    assignee: incoming.assignee ?? existing.assignee,
    channelType: incoming.channelType ?? existing.channelType,
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
    labels: incoming.labels?.length ? incoming.labels : existing.labels,
    contact: incoming.contact ?? existing.contact,
    assignee: incoming.assignee ?? existing.assignee,
    channelType: incoming.channelType ?? existing.channelType,
    lastMessage: pickLatestPreviewMessage(existing.lastMessage, incoming.lastMessage),
    lastMessageAt: mergeConversationLastMessageAt(existing, incoming),
    updatedAt: new Date(
      Math.max(new Date(existing.updatedAt).getTime(), new Date(incoming.updatedAt).getTime())
    ),
  };
}

const markReadWhileViewingTimers = new Map<string, number>();

function isActivelyViewingConversation(
  state: Pick<ConversationState, "activeConversationId" | "isInboxViewActive">,
  conversationId: string
): boolean {
  return (
    state.isInboxViewActive &&
    state.activeConversationId === conversationId &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible"
  );
}

/** Actualiza badge de bandeja tras realtime sin pisar conteos de bandejas no cargadas. */
function syncInboxUnreadAfterRealtime(
  inboxId: string,
  previousUnread: number,
  nextUnread: number
) {
  const { conversationsInboxId, conversations } = useConversationStore.getState();

  if (conversationsInboxId === inboxId) {
    useInboxStore
      .getState()
      .syncInboxUnreadFromConversations(inboxId, conversations);
    return;
  }

  const wasUnread = previousUnread > 0;
  const isUnread = nextUnread > 0;
  if (!wasUnread && isUnread) {
    useInboxStore.getState().adjustInboxUnread(inboxId, 1);
  } else if (wasUnread && !isUnread) {
    useInboxStore.getState().adjustInboxUnread(inboxId, -1);
  }
}

function clearUnreadCountLocally(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  conversationId: string
) {
  const current = useConversationStore
    .getState()
    .conversations.find((item) => item.id === conversationId);
  if (!current || current.unreadCount <= 0) return;

  set((state) => ({
    conversations: state.conversations.map((item) =>
      item.id === conversationId ? { ...item, unreadCount: 0 } : item
    ),
  }));
  // Badge de bandeja cuenta chats, no mensajes.
  useInboxStore.getState().adjustInboxUnread(current.inboxId, -1);
}

function scheduleMarkReadWhileViewing(conversationId: string, reason: string) {
  if (env.useMock) return;

  const existing = markReadWhileViewingTimers.get(conversationId);
  if (existing !== undefined) {
    window.clearTimeout(existing);
  }

  const timer = window.setTimeout(() => {
    markReadWhileViewingTimers.delete(conversationId);
    void conversationApiService.markRead(conversationId, reason).catch(() => {});
  }, 350);

  markReadWhileViewingTimers.set(conversationId, timer);
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
      clientId: pendingId,
      conversationId,
      content,
      senderType: "system",
      isPrivate: false,
      contentType: "text",
      sortOrder: nextOptimisticSortOrder(conversationId),
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

function revokeIfBlobUrl(url?: string) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function mergeServerMessageOverLocal(local: Message, server: Message): Message {
  const pendingClientId =
    local.clientId ??
    (isPendingMessageId(local.id) || isPendingActivityMessageId(local.id) ? local.id : undefined);
  const serverClientId = server.clientMessageId ?? server.clientId;

  const merged: Message = {
    ...server,
    clientId: pendingClientId ?? serverClientId,
    clientMessageId: serverClientId ?? pendingClientId,
    replyTo: server.replyTo ?? local.replyTo,
    attachedToMessageId: server.attachedToMessageId ?? local.attachedToMessageId,
    fileUrl: server.fileUrl ?? local.fileUrl,
    audioUrl: server.audioUrl ?? local.audioUrl,
    audioDuration: server.audioDuration ?? local.audioDuration,
    // Mantener posición visual; el status/id del server sí se actualizan.
    sortOrder: local.sortOrder ?? server.sortOrder,
    createdAt: local.createdAt,
    status:
      isPendingMessageId(local.id) && server.status === "pending"
        ? "sent"
        : server.status ?? local.status,
  };

  return mergeServerMessageOverLocalCleanup(local, merged);
}

function mergeServerMessageOverLocalCleanup(local: Message, merged: Message): Message {
  if (merged.fileUrl && merged.fileUrl !== local.fileUrl) {
    revokeIfBlobUrl(local.fileUrl);
  }
  if (merged.audioUrl && merged.audioUrl !== local.audioUrl) {
    revokeIfBlobUrl(local.audioUrl);
  }
  return merged;
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
  const shouldAutoAssign =
    !isPrivate &&
    newMessage.senderType === "agent" &&
    Boolean(newMessage.senderId);
  const shouldPauseBot =
    !isPrivate && newMessage.senderType === "agent";
  const conversationBefore = get().conversations.find((c) => c.id === conversationId);
  const willAutoAssign = Boolean(
    shouldAutoAssign && conversationBefore && !conversationBefore.assignee && newMessage.senderId
  );
  const pauseMinutes =
    useInboxSettingsStore.getState().getByInboxId(conversationBefore?.inboxId ?? "")
      ?.botPauseMinutes ?? 15;

  set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: updatedMessages,
    },
    conversations: sortConversations(
      state.conversations.map((c) => {
        if (c.id !== conversationId) return c;

        const assignee =
          shouldAutoAssign && !c.assignee && newMessage.senderId
            ? useAgentStore.getState().getAgentById(newMessage.senderId) ?? c.assignee
            : c.assignee;

        return {
          ...c,
          assignee,
          lastMessage: pickLatestPreviewMessage(
            appendedToEnd ? newMessage : null,
            c.lastMessage
          ),
          lastMessageAt:
            affectsSort && appendedToEnd
              ? newMessage.createdAt
              : c.lastMessageAt,
          botPausedUntil: shouldPauseBot
            ? new Date(newMessage.createdAt.getTime() + pauseMinutes * 60 * 1000)
            : c.botPausedUntil,
          updatedAt: new Date(),
        };
      })
    ),
  }));

  if (willAutoAssign && newMessage.senderId) {
    const agent = useAgentStore.getState().getAgentById(newMessage.senderId);
    const actorName = agent?.name ?? getCurrentActorName();
    appendOptimisticActivityIfChatOpen(
      set,
      get,
      conversationId,
      `La conversación fue asignada a ${actorName} por ${actorName}`
    );
  }
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
const PROVISIONAL_INBOUND_PREFIX = "provisional-";

function createPendingMessageId(): string {
  return `${PENDING_MESSAGE_PREFIX}${crypto.randomUUID()}`;
}

function isPendingMessageId(id: string): boolean {
  return id.startsWith(PENDING_MESSAGE_PREFIX);
}

function isProvisionalInboundId(id: string): boolean {
  return id.startsWith(PROVISIONAL_INBOUND_PREFIX);
}

function findPendingOutgoingReplaceIndex(messages: Message[], incoming: Message): number {
  if (incoming.senderType !== "agent") return -1;

  const incomingClientId = incoming.clientMessageId ?? incoming.clientId;
  if (incomingClientId) {
    const byClient = messages.findIndex(
      (item) =>
        isPendingMessageId(item.id) &&
        (item.clientId === incomingClientId || item.id === incomingClientId)
    );
    if (byClient >= 0) return byClient;
  }

  // Fallback legacy: primer pending con mismo fingerprint (puede fallar si el texto se repite).
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

function findProvisionalInboundReplaceIndex(messages: Message[], incoming: Message): number {
  if (incoming.senderType !== "contact" || !incoming.externalId) return -1;

  return messages.findIndex(
    (item) => isProvisionalInboundId(item.id) && item.externalId === incoming.externalId
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
    const pendingIndex = current.findIndex(
      (item) => item.id === pendingId || item.clientId === pendingId
    );
    const serverIndex = current.findIndex((item) => item.id === apiMessage.id);

    let next: Message[];
    if (pendingIndex >= 0) {
      next = [...current];
      next[pendingIndex] = mergeServerMessageOverLocal(current[pendingIndex], apiMessage);
      if (serverIndex >= 0 && serverIndex !== pendingIndex) {
        next = next.filter((_, index) => index !== serverIndex);
      }
    } else if (serverIndex >= 0) {
      next = current.map((item, index) =>
        index === serverIndex ? mergeServerMessageOverLocal(item, apiMessage) : item
      );
    } else {
      next = [...current, { ...apiMessage, clientId: apiMessage.clientId ?? pendingId }];
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

function isOutgoingStillPending(messages: Message[], pendingId: string): boolean {
  return messages.some(
    (item) =>
      isPendingMessageId(item.id) &&
      (item.id === pendingId ||
        item.clientId === pendingId ||
        item.clientMessageId === pendingId)
  );
}

/** Reconcilia solo si el WS aún no confirmó (POST como respaldo). */
function reconcileOutgoingMessageIfStillPending(
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
  const messages = get().messages[conversationId] ?? [];
  if (!isOutgoingStillPending(messages, pendingId)) return;
  reconcileOutgoingMessage(set, get, conversationId, pendingId, apiMessage);
}

function handleOutgoingPostFailure(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  get: () => ConversationState,
  conversationId: string,
  pendingId: string,
  error: unknown,
  fallbackToast: string
) {
  const messages = get().messages[conversationId] ?? [];
  if (!isOutgoingStillPending(messages, pendingId)) return;
  markPendingMessageFailed(set, conversationId, pendingId);
  useUIStore.getState().showToast(
    isApiError(error) ? error.message : fallbackToast
  );
}

function clearTemplateWindowOverrideIfStillPending(
  set: (
    partial:
      | Partial<ConversationState>
      | ((state: ConversationState) => Partial<ConversationState>)
  ) => void,
  get: () => ConversationState,
  conversationId: string,
  pendingId: string
) {
  const messages = get().messages[conversationId] ?? [];
  if (!isOutgoingStillPending(messages, pendingId)) return;
  set((state) => {
    const { [conversationId]: _, ...rest } = state.templateWindowOverrides;
    return { templateWindowOverrides: rest };
  });
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

function markPendingMessageFailed(
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
      [conversationId]: (state.messages[conversationId] ?? []).map((message) =>
        message.id === pendingId ||
        message.clientId === pendingId ||
        message.clientMessageId === pendingId
          ? { ...message, status: "failed" as const }
          : message
      ),
    },
  }));
}

function buildForwardOptimisticMessage(
  source: Message,
  targetConversationId: string,
  pendingId: string,
  agent: { id: string; name: string }
): Message {
  return {
    id: pendingId,
    clientId: pendingId,
    clientMessageId: pendingId,
    conversationId: targetConversationId,
    content: source.content,
    senderType: "agent",
    senderId: agent.id,
    senderName: agent.name,
    isPrivate: false,
    contentType: source.contentType,
    fileName: source.fileName,
    fileSize: source.fileSize,
    fileUrl: source.fileUrl,
    audioUrl: source.audioUrl,
    audioDuration: source.audioDuration,
    sortOrder: nextOptimisticSortOrder(targetConversationId),
    createdAt: new Date(),
    status: "pending",
  };
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
  conversationsInboxId: null,
  filterLabelId: null,

  setConversations: (conversations) => {
    const sorted = sortConversations(conversations);
    const inboxId = get().filterInboxId;
    set({
      conversations: sorted,
      conversationsInboxId: inboxId,
    });
    if (inboxId) {
      useInboxStore.getState().syncInboxUnreadFromConversations(inboxId, sorted);
    }
  },

  setInboxViewActive: (active) => set({ isInboxViewActive: active }),

  setAppDataBootstrapped: (ready) => set({ isAppDataBootstrapped: ready }),

  applyRealtimeMessage: (message, conversation) => {
    let shouldMarkReadWhileViewing = false;
    let previousUnread = 0;
    let nextUnread = conversation.unreadCount;

    set((currentState) => {
      const existingMessages = currentState.messages[conversation.id] ?? [];
      const hasMessage = existingMessages.some((item) => item.id === message.id);
      const existingConversation = currentState.conversations.find(
        (item) => item.id === conversation.id
      );
      const hasConversation = Boolean(existingConversation);
      previousUnread = existingConversation?.unreadCount ?? 0;
      const isNewMessage = !hasMessage;
      const viewing = isActivelyViewingConversation(currentState, conversation.id);

      let mergedConversation = existingConversation
        ? mergeConversationOnRealtimeMessage(
            existingConversation,
            conversation,
            message,
            isNewMessage
          )
        : {
            ...conversation,
            labels: conversation.labels ?? [],
            lastMessage: pickLatestPreviewMessage(conversation.lastMessage, message),
          };

      if (viewing && message.senderType === "contact" && isNewMessage) {
        mergedConversation = { ...mergedConversation, unreadCount: 0 };
        shouldMarkReadWhileViewing = true;
      }
      nextUnread = mergedConversation.unreadCount;

      const conversations = sortConversations(
        hasConversation
          ? currentState.conversations.map((item) =>
              item.id === mergedConversation.id ? mergedConversation : item
            )
          : [mergedConversation, ...currentState.conversations]
      );

      if (hasMessage) {
        const clientId = message.clientMessageId ?? message.clientId;
        const merged = existingMessages
          .filter((item) => {
            if (!clientId || !isPendingMessageId(item.id)) return true;
            return item.clientId !== clientId && item.id !== clientId;
          })
          .map((item) =>
            item.id === message.id ? mergeServerMessageOverLocal(item, message) : item
          );

        return {
          conversations,
          messages: {
            ...currentState.messages,
            [conversation.id]: sortMessagesChronologically(merged),
          },
        };
      }

      const outgoingPendingIndex = findPendingOutgoingReplaceIndex(
        existingMessages,
        message
      );
      const provisionalInboundIndex = findProvisionalInboundReplaceIndex(
        existingMessages,
        message
      );
      const pendingIndex =
        outgoingPendingIndex >= 0
          ? outgoingPendingIndex
          : provisionalInboundIndex >= 0
            ? provisionalInboundIndex
            : findPendingActivityReplaceIndex(existingMessages, message);
      let nextMessages: Message[];

      if (pendingIndex >= 0) {
        nextMessages = [...existingMessages];
        nextMessages[pendingIndex] = mergeServerMessageOverLocal(
          existingMessages[pendingIndex],
          message
        );
        const clientId = message.clientMessageId ?? message.clientId;
        const externalId = message.externalId;
        if (clientId || externalId) {
          nextMessages = nextMessages.filter((item, index) => {
            if (index === pendingIndex) return true;
            if (item.id === message.id) return false;
            if (
              clientId &&
              isPendingMessageId(item.id) &&
              (item.clientId === clientId || item.id === clientId)
            ) {
              return false;
            }
            if (
              externalId &&
              isProvisionalInboundId(item.id) &&
              item.externalId === externalId
            ) {
              return false;
            }
            return true;
          });
        }
        nextMessages = sortMessagesChronologically(nextMessages);
      } else if (
        message.externalId &&
        existingMessages.some(
          (item) => item.externalId === message.externalId && !isProvisionalInboundId(item.id)
        )
      ) {
        nextMessages = existingMessages.map((item) =>
          item.externalId === message.externalId
            ? mergeServerMessageOverLocal(item, message)
            : item
        );
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

    if (shouldMarkReadWhileViewing) {
      scheduleMarkReadWhileViewing(conversation.id, "active-view");
    }

    syncInboxUnreadAfterRealtime(
      conversation.inboxId,
      previousUnread,
      nextUnread
    );

    syncOptimisticSortOrder(conversation.id, message.sortOrder);
    syncTemplateWindowOverride(set, get, conversation.id, get().messages[conversation.id] ?? []);
  },

  applyRealtimeMessageUpdate: (message, conversationId) => {
    const previous = get().messages[conversationId]?.find((item) => item.id === message.id);

    set((state) => {
      const existingMessages = state.messages[conversationId] ?? [];
      const hasMessage = existingMessages.some((item) => item.id === message.id);
      if (!hasMessage) return state;

      return {
        messages: {
          ...state.messages,
          [conversationId]: existingMessages.map((item) =>
            item.id === message.id ? mergeServerMessageOverLocal(item, message) : item
          ),
        },
      };
    });

    if (
      message.status === "failed" &&
      previous?.status !== "failed" &&
      message.senderType === "agent"
    ) {
      useUIStore.getState().showToast("No se pudo entregar el mensaje por WhatsApp");
    }
  },

  applyRealtimeConversation: (conversation) => {
    let previousUnread = 0;
    let nextUnread = conversation.unreadCount;

    set((state) => {
      const existingConversation = state.conversations.find(
        (item) => item.id === conversation.id
      );
      const hasConversation = Boolean(existingConversation);
      previousUnread = existingConversation?.unreadCount ?? 0;
      let mergedConversation = existingConversation
        ? mergeConversationOnRealtimeUpdate(existingConversation, conversation)
        : conversation;

      if (
        isActivelyViewingConversation(state, conversation.id) &&
        mergedConversation.unreadCount > 0
      ) {
        mergedConversation = { ...mergedConversation, unreadCount: 0 };
      }
      nextUnread = mergedConversation.unreadCount;

      const conversations = sortConversations(
        hasConversation
          ? state.conversations.map((item) =>
              item.id === mergedConversation.id ? mergedConversation : item
            )
          : [mergedConversation, ...state.conversations]
      );

      return { conversations };
    });

    syncInboxUnreadAfterRealtime(
      conversation.inboxId,
      previousUnread,
      nextUnread
    );
  },

  sendTemplateMessage: async (conversationId, input) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    if (!conversation || conversation.channelType !== "whatsapp") return false;

    if (env.useMock) {
      const currentAgent = useAgentStore.getState().getAgentById(getCurrentAgentId() ?? "");
      appendMessageToState(
        set,
        get,
        conversationId,
        {
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
        },
        false
      );
      set((state) => ({
        templateWindowOverrides: {
          ...state.templateWindowOverrides,
          [conversationId]: true,
        },
      }));
      return true;
    }

    const currentAgent = useAgentStore.getState().getAgentById(getCurrentAgentId() ?? "");
    const pendingId = createPendingMessageId();
    const optimistic: Message = {
      id: pendingId,
      clientId: pendingId,
      clientMessageId: pendingId,
      conversationId,
      content: input.content,
      senderType: "agent",
      senderId: currentAgent?.id ?? "unknown",
      senderName: currentAgent?.name ?? "Agente",
      isPrivate: false,
      contentType: "text",
      sortOrder: nextOptimisticSortOrder(conversationId),
      createdAt: new Date(),
      status: "pending",
    };

    appendMessageToState(set, get, conversationId, optimistic, false);
    set((state) => ({
      templateWindowOverrides: {
        ...state.templateWindowOverrides,
        [conversationId]: true,
      },
    }));

    void conversationApiService
      .sendTemplate(conversationId, {
        ...input,
        clientMessageId: pendingId,
      })
      .then((apiMessage) => {
        reconcileOutgoingMessageIfStillPending(set, get, conversationId, pendingId, apiMessage);
      })
      .catch((error) => {
        handleOutgoingPostFailure(
          set,
          get,
          conversationId,
          pendingId,
          error,
          "No se pudo enviar la plantilla"
        );
        clearTemplateWindowOverrideIfStillPending(set, get, conversationId, pendingId);
      });
    return true;
  },

  retryFailedMessage: async (conversationId, messageId) => {
    if (env.useMock) return false;

    try {
      const apiMessage = await conversationApiService.retryMessageDelivery(
        conversationId,
        messageId
      );
      set((state) => {
        const existingMessages = state.messages[conversationId] ?? [];
        const hasMessage = existingMessages.some((item) => item.id === messageId);
        if (!hasMessage) return state;

        return {
          messages: {
            ...state.messages,
            [conversationId]: existingMessages.map((item) =>
              item.id === messageId ? mergeServerMessageOverLocal(item, apiMessage) : item
            ),
          },
        };
      });
      return true;
    } catch (error) {
      useUIStore.getState().showToast(
        isApiError(error) ? error.message : "No se pudo reintentar el envío"
      );
      return false;
    }
  },

  forwardMessages: (sourceConversationId, messageIds, targetConversationIds) => {
    if (env.useMock) return false;

    const convMessages = get().messages[sourceConversationId] ?? [];
    const sourceMessages = orderMessagesBySelection(convMessages, messageIds);

    if (sourceMessages.length === 0 || targetConversationIds.length === 0) {
      useUIStore.getState().showToast("No hay mensajes para reenviar");
      return false;
    }

    const currentAgent = useAgentStore.getState().getAgentById(getCurrentAgentId() ?? "");
    const agent = {
      id: currentAgent?.id ?? "unknown",
      name: currentAgent?.name ?? "Agente",
    };

    const deliveries: Array<{
      sourceMessageId: string;
      targetConversationId: string;
      clientMessageId: string;
    }> = [];

    for (const targetConversationId of targetConversationIds) {
      for (const sourceMessage of sourceMessages) {
        const pendingId = createPendingMessageId();

        deliveries.push({
          sourceMessageId: sourceMessage.id,
          targetConversationId,
          clientMessageId: pendingId,
        });

        appendMessageToState(
          set,
          get,
          targetConversationId,
          buildForwardOptimisticMessage(sourceMessage, targetConversationId, pendingId, agent),
          false
        );
      }
    }

    useUIStore.getState().clearForwardFlow();

    void conversationApiService
      .forwardMessages(sourceConversationId, {
        messageIds: sourceMessages.map((message) => message.id),
        targetConversationIds,
        deliveries,
      })
      .then((response) => {
        for (const result of response.results) {
          const pendingId = result.clientMessageId;
          const targetId = result.conversationId;

          if (result.success && result.message) {
            reconcileOutgoingMessageIfStillPending(set, get, targetId, pendingId, {
              ...result.message,
              fileUrl: result.message.fileUrl ?? get().messages[targetId]?.find(m => m.id === pendingId)?.fileUrl,
              audioUrl: result.message.audioUrl ?? get().messages[targetId]?.find(m => m.id === pendingId)?.audioUrl,
            });
            continue;
          }

          if (isOutgoingStillPending(get().messages[targetId] ?? [], pendingId)) {
            markPendingMessageFailed(set, targetId, pendingId);
          }
        }

        const { summary } = response;

        if (summary.failed === 0) {
          const targetLabel =
            targetConversationIds.length === 1
              ? "1 chat"
              : `${targetConversationIds.length} chats`;
          useUIStore.getState().showToast(`Reenviado a ${targetLabel}`);
        } else if (summary.sent === 0) {
          useUIStore.getState().showToast("No se pudo reenviar ningún mensaje");
        } else {
          useUIStore.getState().showToast(
            `${summary.sent} de ${summary.total} envíos completados`
          );
        }
      })
      .catch((error) => {
        for (const delivery of deliveries) {
          if (isOutgoingStillPending(get().messages[delivery.targetConversationId] ?? [], delivery.clientMessageId)) {
            markPendingMessageFailed(set, delivery.targetConversationId, delivery.clientMessageId);
          }
        }
        useUIStore.getState().showToast(
          isApiError(error) ? error.message : "No se pudieron reenviar los mensajes"
        );
      });

    return true;
  },

  sendSavedSticker: async (conversationId, sticker) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    if (!conversation || conversation.channelType !== "whatsapp") return false;

    if (env.useMock) return false;

    const currentAgent = useAgentStore.getState().getAgentById(getCurrentAgentId() ?? "");
    const replyToMessageId = useUIStore.getState().replyToMessage?.id;
    const convMessages = get().messages[conversationId] ?? [];
    const replyTarget = replyToMessageId
      ? convMessages.find((m) => m.id === replyToMessageId)
      : undefined;

    const pendingId = createPendingMessageId();
    const optimistic: Message = {
      id: pendingId,
      clientId: pendingId,
      clientMessageId: pendingId,
      conversationId,
      content: "Sticker",
      senderType: "agent",
      senderId: currentAgent?.id ?? "unknown",
      senderName: currentAgent?.name ?? "Agente",
      isPrivate: false,
      replyTo: replyTarget
        ? {
            id: replyTarget.id,
            content: replyTarget.content,
            senderName: replyTarget.senderName,
            senderType: replyTarget.senderType as "agent" | "contact" | "bot",
          }
        : undefined,
      contentType: "sticker",
      fileName: sticker.fileName,
      fileSize: sticker.fileSize,
      fileUrl: sticker.fileUrl,
      sortOrder: nextOptimisticSortOrder(conversationId),
      createdAt: new Date(),
      status: "pending",
    };

    appendMessageToState(set, get, conversationId, optimistic, false);
    useUIStore.getState().setReplyToMessage(null);

    void stickerApiService
      .send(conversationId, sticker.id, replyToMessageId, pendingId)
      .then((apiMessage) => {
        reconcileOutgoingMessageIfStillPending(set, get, conversationId, pendingId, {
          ...apiMessage,
          replyTo: apiMessage.replyTo ?? optimistic.replyTo,
          fileUrl: apiMessage.fileUrl ?? optimistic.fileUrl,
        });
      })
      .catch((error) => {
        handleOutgoingPostFailure(
          set,
          get,
          conversationId,
          pendingId,
          error,
          "No se pudo enviar el sticker"
        );
      });
    return true;
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

    if (unreadCount <= 0) return;

    clearUnreadCountLocally(set, id);

    if (env.useMock) return;

    scheduleMarkReadWhileViewing(id, "user-open");
  },

  acknowledgeConversationRead: (id, reason = "acknowledge") => {
    const unreadCount =
      get().conversations.find((conversation) => conversation.id === id)?.unreadCount ?? 0;
    if (unreadCount <= 0) return;

    clearUnreadCountLocally(set, id);
    if (env.useMock) return;
    scheduleMarkReadWhileViewing(id, reason);
  },

  clearActiveConversationSelection: () => {
    get().selectConversation(null);
  },

  setFilterStatus: (status) => set({ filterStatus: status }),
  setFilterAssignee: (assignee) => set({ filterAssignee: assignee }),
  setFilterInboxId: (inboxId) => {
    const agentId = getCurrentAgentId();
    if (agentId && inboxId) {
      saveInboxFilter(agentId, inboxId);
    }

    // Al cambiar de bandeja: no sincronizar badge en vivo hasta que llegue la lista de esa bandeja.
    set({
      filterInboxId: inboxId,
      conversationsInboxId: null,
      filterLabelId: null,
      activeConversationId: null,
      filterStatus: "open",
      filterAssignee: "all",
    });

    if (!env.useMock) {
      if (!inboxId) {
        set({ conversations: [], conversationsInboxId: null });
        return;
      }
      void conversationApiService
        .list({ inboxId, status: "all", assignee: "all" })
        .then((conversations) => {
          if (get().filterInboxId !== inboxId) return;
          get().setConversations(conversations);
        })
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
      botPausedUntil: null,
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
      clientId: overrides?.clientId ?? overrides?.id,
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
      audioUrl: overrides?.audioUrl ?? options?.audioUrl,
      audioDuration: options?.audioDuration,
      fileName: overrides?.fileName ?? options?.fileName,
      fileSize: overrides?.fileSize ?? options?.fileSize,
      fileUrl: overrides?.fileUrl ?? options?.fileUrl,
      linkPreview: overrides?.linkPreview ?? options?.linkPreview,
      linkPreviewSuppressed:
        overrides?.linkPreviewSuppressed ?? options?.suppressLinkPreview,
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
      const isWhatsAppOutbound =
        !isPrivate && conversation?.channelType === "whatsapp";
      const uploadFile = options?.file;
      const contentType = options?.contentType ?? "text";

      let previewFileUrl = options?.fileUrl;
      let previewAudioUrl = options?.audioUrl;
      if (uploadFile) {
        if ((contentType === "image" || contentType === "sticker") && !previewFileUrl) {
          previewFileUrl = URL.createObjectURL(uploadFile);
        }
        if (contentType === "audio" && !previewAudioUrl) {
          previewAudioUrl = URL.createObjectURL(uploadFile);
        }
      }

      const optimistic = buildLocalMessage({
        id: pendingId,
        clientId: pendingId,
        clientMessageId: pendingId,
        status: isWhatsAppOutbound ? "pending" : "sent",
        fileUrl: previewFileUrl,
        audioUrl: previewAudioUrl,
        fileName: options?.fileName ?? uploadFile?.name,
        fileSize: options?.fileSize ?? uploadFile?.size,
        linkPreview: options?.linkPreview,
        linkPreviewSuppressed: options?.suppressLinkPreview,
      });
      appendMessageToState(
        set,
        get,
        conversationId,
        optimistic,
        isPrivate,
        attachedToMessageId
      );

      if (
        uploadFile &&
        (contentType === "image" ||
          contentType === "file" ||
          contentType === "audio" ||
          contentType === "sticker")
      ) {
        void conversationApiService
          .sendMessageWithFile(
            conversationId,
            uploadFile,
            content,
            isPrivate,
            contentType,
            replyToMessageId,
            pendingId
          )
          .then((apiMessage) => {
            reconcileOutgoingMessageIfStillPending(set, get, conversationId, pendingId, {
              ...apiMessage,
              replyTo: apiMessage.replyTo ?? optimistic.replyTo,
              attachedToMessageId: optimistic.attachedToMessageId,
              fileUrl: apiMessage.fileUrl ?? optimistic.fileUrl,
              audioUrl:
                contentType === "audio"
                  ? apiMessage.fileUrl ?? optimistic.audioUrl
                  : optimistic.audioUrl,
              audioDuration: options?.audioDuration,
            });
          })
          .catch((error) => {
            handleOutgoingPostFailure(
              set,
              get,
              conversationId,
              pendingId,
              error,
              "No se pudo enviar el archivo"
            );
          });
        return;
      }

      void conversationApiService
        .sendMessage(conversationId, content, isPrivate, {
          contentType,
          replyToMessageId,
          clientMessageId: pendingId,
          linkPreview: options?.linkPreview,
          suppressLinkPreview: options?.suppressLinkPreview,
        })
        .then((apiMessage) => {
          reconcileOutgoingMessageIfStillPending(set, get, conversationId, pendingId, {
            ...apiMessage,
            replyTo: apiMessage.replyTo ?? optimistic.replyTo,
            attachedToMessageId: optimistic.attachedToMessageId,
            linkPreview: apiMessage.linkPreview ?? optimistic.linkPreview,
            linkPreviewSuppressed:
              apiMessage.linkPreviewSuppressed ?? optimistic.linkPreviewSuppressed,
            audioUrl: options?.audioUrl,
            audioDuration: options?.audioDuration,
          });
        })
        .catch((error) => {
          handleOutgoingPostFailure(
            set,
            get,
            conversationId,
            pendingId,
            error,
            "No se pudo enviar el mensaje"
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
    } else if (status === "resolved") {
      pendingActivityId = appendOptimisticActivityIfChatOpen(
        set,
        get,
        id,
        `La conversación fue marcada como resuelta por ${actorName}`
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
    const current = get().conversations.find((c) => c.id === id);
    if (!current) return;
    const wasRead = current.unreadCount <= 0;
    const nextUnread = Math.max(current.unreadCount, 1);

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, unreadCount: nextUnread } : c
      ),
    }));

    if (wasRead) {
      useInboxStore.getState().adjustInboxUnread(current.inboxId, 1);
    }

    if (!env.useMock) {
      void conversationApiService.updateConversation(id, { unreadCount: 1 }).catch(() => {});
    }
  },

  removeLabelFromAllConversations: (labelId) => {
    set((state) => ({
      conversations: state.conversations.map((conversation) => ({
        ...conversation,
        labels: conversation.labels.filter((label) => label.id !== labelId),
      })),
      filterLabelId: state.filterLabelId === labelId ? null : state.filterLabelId,
    }));
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
    const { conversations, filterAssignee, filterInboxId, filterLabelId, filterStatus } =
      get();
    let filtered = conversations;
    if (filterStatus === "open" || filterStatus === "resolved") {
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
    return get().conversations.filter((c) => c.unreadCount > 0).length;
  },
}));
