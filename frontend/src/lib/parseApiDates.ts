import type { Conversation, Message } from "@/types";

export function parseMessage(raw: Message & { createdAt: string | Date }): Message {
  return {
    ...raw,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
  };
}

export function parseConversation(
  raw: Conversation & {
    createdAt: string | Date;
    updatedAt: string | Date;
    lastMessage: (Message & { createdAt: string | Date }) | null;
  }
): Conversation {
  return {
    ...raw,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : new Date(raw.updatedAt),
    lastMessage: raw.lastMessage ? parseMessage(raw.lastMessage) : null,
  };
}
