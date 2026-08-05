import type { Message } from "@/types";

export function messageSenderKey(message: Message): string {
  if (message.isPrivate) return "private";
  if (message.senderType === "system") return "system";
  if (message.senderType === "contact") {
    return `contact:${message.senderId ?? message.senderName ?? "unknown"}`;
  }
  return `${message.senderType}:${message.senderId ?? message.senderName ?? "unknown"}`;
}

/** True if the next message starts a new visual cluster (avatar/time block). */
export function isLastMessageInSenderGroup(
  current: Message,
  next: Message | undefined
): boolean {
  if (current.isPrivate) return true;
  if (!next) return true;
  if (next.isPrivate) return true;
  if (next.attachedToMessageId) return true;
  return messageSenderKey(current) !== messageSenderKey(next);
}

export function isOutboundMessage(message: Message): boolean {
  return message.senderType === "agent" || message.senderType === "bot";
}

export function messageSenderDisplayName(
  message: Message,
  contactFallback?: string
): string {
  if (message.senderType === "contact") {
    // Mismo nombre que el listado / ficha del contacto (no el profile.name de WhatsApp por mensaje).
    return contactFallback?.trim() || message.senderName?.trim() || "Contacto";
  }
  if (message.senderName?.trim()) return message.senderName.trim();
  if (message.senderType === "bot") return "Bot";
  return "Agente";
}
