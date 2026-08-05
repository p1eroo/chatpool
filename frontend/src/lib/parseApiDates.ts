import type { Conversation, Message } from "@/types";

export function parseMessage(
  raw: Message & { createdAt: string | Date; sortOrder?: number; clientMessageId?: string }
): Message {
  const clientMessageId = raw.clientMessageId ?? raw.clientId;
  return {
    ...raw,
    clientId: raw.clientId ?? clientMessageId,
    clientMessageId,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
    sortOrder: raw.sortOrder,
  };
}

export function parseConversation(
  raw: Conversation & {
    createdAt: string | Date;
    updatedAt: string | Date;
    lastMessageAt?: string | Date | null;
    lastMessage: (Message & { createdAt: string | Date }) | null;
  }
): Conversation {
  return {
    ...raw,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : new Date(raw.updatedAt),
    lastMessageAt:
      raw.lastMessageAt == null
        ? null
        : raw.lastMessageAt instanceof Date
          ? raw.lastMessageAt
          : new Date(raw.lastMessageAt),
    lastMessage: raw.lastMessage ? parseMessage(raw.lastMessage) : null,
  };
}
