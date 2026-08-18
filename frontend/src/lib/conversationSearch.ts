import { formatLocalWhatsAppPhoneDisplay } from "@/lib/whatsappPhone";
import { sortMessagesChronologically } from "@/lib/messageOrder";
import type { Conversation, Message } from "@/types";

export const INBOX_SEARCH_MIN_QUERY = 2;

export type ConversationSearchHit = {
  conversation: Conversation;
  matchedMessageId: string | null;
};

/** Mensajes del historial cuyo texto incluye la consulta, en orden cronológico. */
export function findMatchingMessageIds(
  messages: Message[] | undefined,
  rawQuery: string
): string[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query || !messages?.length) return [];

  return sortMessagesChronologically(messages)
    .filter((message) => message.content?.toLowerCase().includes(query))
    .map((message) => message.id);
}

/** Último mensaje del historial cuyo texto incluye la consulta. */
export function findMatchingMessageId(
  messages: Message[] | undefined,
  rawQuery: string
): string | null {
  const matches = findMatchingMessageIds(messages, rawQuery);
  return matches[matches.length - 1] ?? null;
}

/** Búsqueda local: contacto, último mensaje y historial ya cargado en memoria. */
export function matchesConversationSearch(
  conversation: Conversation,
  rawQuery: string,
  loadedMessages?: Message[]
) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const phone = conversation.contact.phone ?? "";
  const haystack = [
    conversation.contact.name,
    phone,
    formatLocalWhatsAppPhoneDisplay(phone),
    conversation.contact.email,
    conversation.contact.waId,
    conversation.lastMessage?.content,
    ...(loadedMessages?.map((message) => message.content) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}
