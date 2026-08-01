import type { ChannelType, Message } from "@/types";

export const WHATSAPP_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export const WHATSAPP_WINDOW_DOCS_URL =
  "https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#customer-service-windows";

/** Último mensaje entrante del contacto (no privado). */
export function getLastContactMessage(messages: Message[]): Message | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.senderType === "contact" && !message.isPrivate) {
      return message;
    }
  }
  return null;
}

export function isWhatsAppChannel(channelType?: ChannelType): boolean {
  return channelType === "whatsapp";
}

/** Ventana de respuesta libre cerrada (solo plantillas Meta). */
export function isWhatsAppReplyWindowClosed(
  channelType: ChannelType | undefined,
  messages: Message[],
  options?: { templateUnlocked?: boolean; now?: Date }
): boolean {
  if (!isWhatsAppChannel(channelType)) return false;
  if (options?.templateUnlocked) return false;

  const lastContact = getLastContactMessage(messages);
  if (!lastContact) return true;

  const now = options?.now ?? new Date();
  return now.getTime() - lastContact.createdAt.getTime() >= WHATSAPP_REPLY_WINDOW_MS;
}

export function getWhatsAppWindowRemainingMs(
  messages: Message[],
  now: Date = new Date()
): number | null {
  const lastContact = getLastContactMessage(messages);
  if (!lastContact) return null;

  const elapsed = now.getTime() - lastContact.createdAt.getTime();
  return Math.max(0, WHATSAPP_REPLY_WINDOW_MS - elapsed);
}
