import type { Message } from "@/types";

export function compareMessagesChronologically(a: Message, b: Message): number {
  const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (timeDiff !== 0) return timeDiff;

  const aSort = a.sortOrder;
  const bSort = b.sortOrder;

  if (aSort != null && bSort != null && aSort !== bSort) {
    return aSort - bSort;
  }

  if (aSort != null && bSort == null) return -1;
  if (aSort == null && bSort != null) return 1;

  return a.id.localeCompare(b.id);
}

export function sortMessagesChronologically(messages: Message[]): Message[] {
  return [...messages].sort(compareMessagesChronologically);
}
