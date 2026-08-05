import { apiRequest, apiUpload } from "@/api/client";
import { parseConversation, parseMessage } from "@/lib/parseApiDates";
import type { AssigneeFilter } from "@/store/conversationStore";
import type { Contact, Conversation, LinkPreview, Message } from "@/types";

export const conversationApiService = {
  async list(filters?: {
    inboxId?: string | null;
    status?: string;
    assignee?: AssigneeFilter;
    labelId?: string | null;
  }): Promise<Conversation[]> {
    const params = new URLSearchParams();
    if (filters?.inboxId) params.set("inboxId", filters.inboxId);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.assignee) params.set("assignee", filters.assignee);
    if (filters?.labelId) params.set("labelId", filters.labelId);

    const query = params.toString();
    const rows = await apiRequest<Conversation[]>(
      `/conversations${query ? `?${query}` : ""}`
    );
    return rows.map((row) => parseConversation(row as never));
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const rows = await apiRequest<Message[]>(`/conversations/${conversationId}/messages`);
    return rows.map((row) => parseMessage(row as never));
  },

  async startOutbound(params: {
    inboxId: string;
    phone: string;
    name?: string;
  }): Promise<{ contact: Contact; conversation: Conversation; reopened: boolean }> {
    const row = await apiRequest<{
      contact: Contact;
      conversation: Conversation;
      reopened: boolean;
    }>("/conversations/start", {
      method: "POST",
      body: params,
    });

    return {
      contact: {
        ...row.contact,
        lastSeen: row.contact.lastSeen
          ? row.contact.lastSeen instanceof Date
            ? row.contact.lastSeen
            : new Date(row.contact.lastSeen)
          : undefined,
      },
      conversation: parseConversation(row.conversation as never),
      reopened: row.reopened,
    };
  },

  async markRead(conversationId: string, reason = "unknown"): Promise<void> {
    if (import.meta.env.DEV) {
      console.warn("[markRead]", conversationId, reason, new Error().stack);
    }
    await apiRequest(`/conversations/${conversationId}/read`, {
      method: "POST",
      headers: { "X-Chatpool-Read-Reason": reason },
    });
  },

  async sendMessage(
    conversationId: string,
    content: string,
    isPrivate: boolean,
    options?: {
      contentType?: Message["contentType"];
      replyToMessageId?: string;
      clientMessageId?: string;
      linkPreview?: LinkPreview;
      suppressLinkPreview?: boolean;
    }
  ): Promise<Message> {
    const row = await apiRequest<Message>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: {
        content,
        isPrivate,
        contentType: options?.contentType ?? "text",
        replyToMessageId: options?.replyToMessageId,
        clientMessageId: options?.clientMessageId,
        linkPreview: options?.linkPreview,
        suppressLinkPreview: options?.suppressLinkPreview,
      },
    });
    return parseMessage(row as never);
  },

  async sendMessageWithFile(
    conversationId: string,
    file: File,
    content: string,
    isPrivate: boolean,
    contentType: "image" | "file" | "audio" | "sticker",
    replyToMessageId?: string,
    clientMessageId?: string
  ): Promise<Message> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("content", content);
    formData.append("isPrivate", String(isPrivate));
    formData.append("contentType", contentType);
    if (replyToMessageId) {
      formData.append("replyToMessageId", replyToMessageId);
    }
    if (clientMessageId) {
      formData.append("clientMessageId", clientMessageId);
    }

    const row = await apiUpload<Message>(`/conversations/${conversationId}/messages`, formData);
    return parseMessage(row as never);
  },

  async updateConversation(
    conversationId: string,
    patch: { status?: Conversation["status"]; assigneeId?: string | null; unreadCount?: number }
  ): Promise<Conversation> {
    const row = await apiRequest<Conversation>(`/conversations/${conversationId}`, {
      method: "PATCH",
      body: patch,
    });
    return parseConversation(row as never);
  },

  async toggleLabel(conversationId: string, labelId: string): Promise<Conversation> {
    const row = await apiRequest<Conversation>(
      `/conversations/${conversationId}/labels/${labelId}/toggle`,
      { method: "POST" }
    );
    return parseConversation(row as never);
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await apiRequest(`/conversations/${conversationId}`, { method: "DELETE" });
  },

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    await apiRequest(`/conversations/${conversationId}/messages/${messageId}`, {
      method: "DELETE",
    });
  },

  async sendTemplate(
    conversationId: string,
    payload: {
      templateId: string;
      templateName: string;
      language: string;
      content: string;
      bodyParameters?: string[];
      headerParameters?: string[];
      buttonUrlParameters?: Array<{ index: number; text: string }>;
      clientMessageId?: string;
    }
  ): Promise<Message> {
    const row = await apiRequest<Message>(`/conversations/${conversationId}/templates`, {
      method: "POST",
      body: payload,
    });
    return parseMessage(row as never);
  },

  async retryMessageDelivery(conversationId: string, messageId: string): Promise<Message> {
    const row = await apiRequest<Message>(
      `/conversations/${conversationId}/messages/${messageId}/retry-delivery`,
      { method: "POST" }
    );
    return parseMessage(row as never);
  },

  async forwardMessages(
    sourceConversationId: string,
    payload: {
      messageIds: string[];
      targetConversationIds: string[];
      deliveries: Array<{
        sourceMessageId: string;
        targetConversationId: string;
        clientMessageId: string;
      }>;
    }
  ): Promise<{
    results: Array<{
      sourceMessageId: string;
      conversationId: string;
      clientMessageId: string;
      success: boolean;
      message?: Message;
      error?: string;
      code?: string;
    }>;
    summary: { sent: number; failed: number; total: number };
  }> {
    const row = await apiRequest<{
      results: Array<{
        sourceMessageId: string;
        conversationId: string;
        clientMessageId: string;
        success: boolean;
        message?: Message;
        error?: string;
        code?: string;
      }>;
      summary: { sent: number; failed: number; total: number };
    }>(`/conversations/${sourceConversationId}/messages/forward`, {
      method: "POST",
      body: payload,
    });

    return {
      ...row,
      results: row.results.map((item) => ({
        ...item,
        message: item.message ? parseMessage(item.message as never) : undefined,
      })),
    };
  },
};
