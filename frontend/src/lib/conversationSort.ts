import type { Conversation, Message } from "@/types";

export function shouldMessageAffectConversationSort(
  message: Pick<Message, "senderType" | "isPrivate">
): boolean {
  return message.senderType !== "system" && !message.isPrivate;
}

export function getConversationSortTime(conversation: Conversation): number {
  if (conversation.lastMessageAt) {
    return conversation.lastMessageAt.getTime();
  }

  if (conversation.lastMessage) {
    return conversation.lastMessage.createdAt.getTime();
  }

  return conversation.updatedAt.getTime();
}

export function compareConversationsByRecentActivity(
  a: Conversation,
  b: Conversation
): number {
  return getConversationSortTime(b) - getConversationSortTime(a);
}

export function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(compareConversationsByRecentActivity);
}

export function resolveLastMessageAt(
  conversation: Conversation,
  message?: Message | null
): Date | null {
  if (message && shouldMessageAffectConversationSort(message)) {
    return message.createdAt;
  }

  return conversation.lastMessageAt;
}

export function mergeConversationLastMessageAt(
  existing: Conversation,
  incoming: Conversation,
  message?: Message | null
): Date | null {
  const candidates = [
    incoming.lastMessageAt,
    message && shouldMessageAffectConversationSort(message) ? message.createdAt : null,
    existing.lastMessageAt,
    incoming.lastMessage?.createdAt ?? null,
    existing.lastMessage?.createdAt ?? null,
  ].filter((value): value is Date => value instanceof Date);

  if (candidates.length === 0) return null;

  return candidates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  );
}
