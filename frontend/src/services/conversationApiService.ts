import { apiRequest, apiUpload } from "@/api/client";
import { parseConversation, parseMessage } from "@/lib/parseApiDates";
import type { AssigneeFilter } from "@/store/conversationStore";
import type { Contact, Conversation, Message } from "@/types";

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
    options?: { contentType?: Message["contentType"]; replyToMessageId?: string }
  ): Promise<Message> {
    const row = await apiRequest<Message>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: {
        content,
        isPrivate,
        contentType: options?.contentType ?? "text",
        replyToMessageId: options?.replyToMessageId,
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
    replyToMessageId?: string
  ): Promise<Message> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("content", content);
    formData.append("isPrivate", String(isPrivate));
    formData.append("contentType", contentType);
    if (replyToMessageId) {
      formData.append("replyToMessageId", replyToMessageId);
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
    }
  ): Promise<Message> {
    const row = await apiRequest<Message>(`/conversations/${conversationId}/templates`, {
      method: "POST",
      body: payload,
    });
    return parseMessage(row as never);
  },
};
