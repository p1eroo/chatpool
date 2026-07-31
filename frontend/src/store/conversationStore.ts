import { create } from "zustand";
import type { ChannelType, Contact, Conversation, ConversationStatus, Message } from "@/types";
import { conversations, getMessages, allAgents, currentUser, labels as allLabels } from "@/data/mock";

export type AssigneeFilter = "mine" | "unassigned" | "all";

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  filterStatus: string;
  filterAssignee: AssigneeFilter;
  filterInboxId: string | null;

  setActiveConversation: (id: string | null) => void;
  setFilterStatus: (status: string) => void;
  setFilterAssignee: (assignee: AssigneeFilter) => void;
  setFilterInboxId: (inboxId: string | null) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    isPrivate: boolean,
    options?: { attachedToMessageId?: string; replyToMessageId?: string }
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

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations,
  activeConversationId: null,
  messages: {},
  filterStatus: "open",
  filterAssignee: "mine",
  filterInboxId: null,

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id && !get().messages[id]) {
      set((state) => ({
        messages: { ...state.messages, [id]: getMessages(id) },
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, unreadCount: 0 } : c
        ),
      }));
    }
  },

  setFilterStatus: (status) => set({ filterStatus: status }),
  setFilterAssignee: (assignee) => set({ filterAssignee: assignee }),
  setFilterInboxId: (inboxId) => set({ filterInboxId: inboxId }),

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

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      content,
      senderType: "agent",
      senderId: "agent-1",
      senderName: "Carlos Mendoza",
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
      contentType: "text",
      createdAt: attachedMessage
        ? new Date(attachedMessage.createdAt.getTime() - (existingAttachedNotes + 1))
        : new Date(),
      status: "sent",
    };

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
  },

  reassignConversation: (id, agentId) => {
    const agent = allAgents.find((a) => a.id === agentId);
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, assignee: agent || undefined } : c
      ),
    }));
  },

  markAsUnread: (id) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, unreadCount: Math.max(c.unreadCount, 1) } : c
      ),
    }));
  },

  toggleConversationLabel: (id, labelId) => {
    const label = allLabels.find((l) => l.id === labelId);
    if (!label) return;

    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== id) return c;
        const hasLabel = c.labels.some((l) => l.id === labelId);
        return {
          ...c,
          labels: hasLabel
            ? c.labels.filter((l) => l.id !== labelId)
            : [...c.labels, label],
        };
      }),
    }));
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
    const { conversations, filterStatus, filterAssignee, filterInboxId } = get();
    let filtered = conversations;
    if (filterStatus !== "all") {
      filtered = filtered.filter((c) => c.status === filterStatus);
    }
    if (filterAssignee === "mine") {
      filtered = filtered.filter((c) => c.assignee?.id === currentUser.id);
    } else if (filterAssignee === "unassigned") {
      filtered = filtered.filter((c) => !c.assignee);
    }
    if (filterInboxId) {
      filtered = filtered.filter((c) => c.inboxId === filterInboxId);
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
