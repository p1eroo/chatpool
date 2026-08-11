import type { Conversation, Message } from "../../types/api-responses.js";
import { parseMetaMessageTimestamp } from "../../shared/meta-message-time.js";
import { parseIncomingMetaMedia } from "../media/meta-media.service.js";
import { broadcastMessageCreated } from "../realtime/realtime.service.js";
import {
  mapConversationMessageEmit,
  type ConversationMessageEmitRow,
} from "../realtime/conversation-realtime-emit.js";
import { getInboundContactContext } from "../contacts/inbound-contact-context-cache.js";
import {
  markInboundProvisionalEmitted,
  wasInboundProvisionalEmitted,
} from "./inbound-provisional-emit-cache.js";

export const PROVISIONAL_INBOUND_PREFIX = "provisional-";

/** Tipos de webhook entrante que no deben crear mensajes en el hilo. */
const IGNORED_INBOUND_MESSAGE_TYPES = new Set(["reaction"]);

export function shouldIgnoreInboundMessageType(type?: string): boolean {
  return type != null && IGNORED_INBOUND_MESSAGE_TYPES.has(type);
}

export function provisionalInboundMessageId(externalId: string): string {
  return `${PROVISIONAL_INBOUND_PREFIX}${externalId}`;
}

interface InboundWebhookMessage {
  id?: string;
  type?: string;
  timestamp?: string;
  text?: { body?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
  voice?: { id?: string; mime_type?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  sticker?: { id?: string; mime_type?: string };
  location?: {
    latitude?: number | string;
    longitude?: number | string;
    name?: string;
    address?: string;
  };
}

export function parseInboundWebhookContent(
  messageId: string,
  message: InboundWebhookMessage
): {
  content: string;
  contentType: Message["contentType"];
  fileName: string | null;
  mimeType: string | null;
  mediaExternalId: string | null;
  location: Message["location"] | null;
} {
  const parsed = parseIncomingMetaMedia(message.type, messageId, message);
  const fallbackContent = `[${message.type ?? "mensaje"}]`;

  if (!parsed) {
    return {
      content: fallbackContent,
      contentType: "text",
      fileName: null,
      mimeType: null,
      mediaExternalId: null,
      location: null,
    };
  }

  if (parsed.contentType === "text") {
    return {
      content: parsed.content,
      contentType: "text",
      fileName: null,
      mimeType: null,
      mediaExternalId: null,
      location: null,
    };
  }

  return {
    content: parsed.content || parsed.fileName || fallbackContent,
    contentType: parsed.contentType,
    fileName: parsed.fileName || null,
    mimeType: parsed.mimeType || null,
    mediaExternalId: parsed.mediaId || null,
    location: parsed.location ?? null,
  };
}

/** Mensaje WS emitido antes de persistir en BD (id estable por wamid de Meta). */
export function buildInboundProvisionalMessage(params: {
  externalId: string;
  conversationId: string;
  contactId: string;
  contactName: string;
  message: InboundWebhookMessage;
}): Message {
  const { content, contentType, fileName, mimeType, mediaExternalId, location } =
    parseInboundWebhookContent(params.externalId, params.message);
  const createdAt = parseMetaMessageTimestamp(params.message.timestamp);

  return {
    id: provisionalInboundMessageId(params.externalId),
    conversationId: params.conversationId,
    content,
    senderType: "contact",
    senderId: params.contactId,
    senderName: params.contactName,
    isPrivate: false,
    contentType,
    fileName: fileName ?? undefined,
    location: location ?? undefined,
    externalId: params.externalId,
    createdAt: createdAt.toISOString(),
    status: "delivered",
    ...(mediaExternalId && contentType !== "text" && contentType !== "location"
      ? {
          attachmentUrl: `/conversations/${params.conversationId}/messages/${provisionalInboundMessageId(params.externalId)}/attachment`,
        }
      : {}),
  };
}

/**
 * Emite provisional sin tocar BD cuando ya conocemos contacto+conversación (cache).
 * Llamar antes de la cola serializada para ráfagas del mismo contacto.
 */
export function tryEmitInboundProvisionalFast(params: {
  inboxId: string;
  identityKey: string;
  message: InboundWebhookMessage;
}): boolean {
  if (!params.message.id) return false;

  const cached = getInboundContactContext(params.inboxId, params.identityKey);
  if (!cached) return false;

  if (!markInboundProvisionalEmitted(params.message.id)) return false;

  const messageAt = parseMetaMessageTimestamp(params.message.timestamp);
  const provisional = buildInboundProvisionalMessage({
    externalId: params.message.id,
    conversationId: cached.conversationId,
    contactId: cached.contactId,
    contactName: cached.contactName,
    message: params.message,
  });

  broadcastMessageCreated(
    provisional,
    buildInboundProvisionalConversation(cached.conversationBase, provisional, messageAt)
  );

  return true;
}

export function emitInboundProvisionalIfNeeded(params: {
  externalId: string;
  conversationId: string;
  contactId: string;
  contactName: string;
  conversationBase: ConversationMessageEmitRow;
  message: InboundWebhookMessage;
}): void {
  if (wasInboundProvisionalEmitted(params.externalId)) return;
  if (!markInboundProvisionalEmitted(params.externalId)) return;

  const messageAt = parseMetaMessageTimestamp(params.message.timestamp);
  const provisional = buildInboundProvisionalMessage({
    externalId: params.externalId,
    conversationId: params.conversationId,
    contactId: params.contactId,
    contactName: params.contactName,
    message: params.message,
  });

  broadcastMessageCreated(
    provisional,
    buildInboundProvisionalConversation(params.conversationBase, provisional, messageAt)
  );
}

/** Conversación para el sidebar/preview al emitir el provisional. */
export function buildInboundProvisionalConversation(
  base: ConversationMessageEmitRow,
  message: Message,
  messageAt: Date
): Conversation {
  return mapConversationMessageEmit(
    {
      ...base,
      unreadCount: base.unreadCount + 1,
      lastMessageAt: messageAt,
      updatedAt: new Date(),
    },
    {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      senderType: message.senderType,
      senderAgentId: null,
      senderContactId: message.senderId ?? null,
      senderName: message.senderName ?? null,
      isPrivate: false,
      attachedToMessageId: null,
      contentType: message.contentType,
      fileName: message.fileName ?? null,
      fileSize: message.fileSize ?? null,
      fileKey: null,
      mimeType: message.mimeType ?? null,
      mediaExternalId: null,
      externalId: message.externalId ?? null,
      clientMessageId: null,
      status: message.status ?? "delivered",
      sortOrder: 0,
      createdAt: messageAt,
      senderContact: message.senderName ? { name: message.senderName } : null,
    }
  );
}
