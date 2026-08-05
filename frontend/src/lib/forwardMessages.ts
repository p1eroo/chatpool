import type { Message } from "@/types";

const FORWARDABLE_CONTENT_TYPES = new Set<Message["contentType"]>([
  "text",
  "image",
  "file",
  "audio",
  "sticker",
]);

export function isForwardableMessage(message: Message): boolean {
  if (message.senderType === "system") return false;
  if (message.isPrivate) return false;
  return FORWARDABLE_CONTENT_TYPES.has(message.contentType);
}

/** Conserva el orden en que el usuario seleccionó los mensajes (no el cronológico del chat). */
export function orderMessagesBySelection(
  messages: Message[],
  selectedIds: string[]
): Message[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  return selectedIds.flatMap((id) => {
    const message = byId.get(id);
    return message && isForwardableMessage(message) ? [message] : [];
  });
}
