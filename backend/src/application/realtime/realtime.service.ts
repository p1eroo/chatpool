import type { Conversation, Message } from "../../types/api-responses.js";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { broadcastRealtime } from "../../infrastructure/realtime/realtime-hub.js";
import { mapConversation, mapMessage, messageInclude } from "../mappers.js";
import { PROVISIONAL_INBOUND_PREFIX } from "../webhooks/inbound-provisional-message.js";
import { dispatchOutgoingWebhook } from "../webhooks/outbound-webhook.service.js";

export const conversationPreviewMessages = {
  where: { senderType: { not: "system" as const } },
  orderBy: [{ sortOrder: "desc" as const }, { createdAt: "desc" as const }],
  take: 1,
  include: messageInclude,
};

export const conversationRealtimeInclude = {
  contact: true,
  assignee: true,
  inbox: true,
  labels: { include: { label: true } },
  messages: conversationPreviewMessages,
} as const;

type MessageRow = Parameters<typeof mapMessage>[0];
type ConversationRow = Parameters<typeof mapConversation>[0];

export function broadcastMessageCreated(message: Message, conversation: Conversation): void {
  broadcastRealtime({
    type: "message.created",
    payload: { message, conversation },
  });

  // Los provisionals solo van por WS; el webhook externo espera el mensaje persistido.
  if (message.id.startsWith(PROVISIONAL_INBOUND_PREFIX)) return;

  dispatchOutgoingWebhook(
    "message_created",
    {
      id: message.id,
      content: message.content,
      content_type: message.contentType,
      message_type:
        message.senderType === "contact"
          ? "incoming"
          : message.senderType === "agent"
            ? "outgoing"
            : "activity",
      private: message.isPrivate,
      created_at: message.createdAt,
      source_id: message.externalId ?? null,
      sender: {
        id: message.senderId ?? null,
        name: message.senderName ?? null,
        type: message.senderType,
      },
      conversation: {
        id: conversation.id,
        inbox_id: conversation.inboxId,
        status: conversation.status,
        channel_type: conversation.channelType,
      },
      inbox: {
        id: conversation.inboxId,
        channel_type: conversation.channelType,
      },
      contact: {
        id: conversation.contact.id,
        name: conversation.contact.name,
        phone: conversation.contact.phone ?? null,
      },
    },
    conversation.inboxId
  );
}

export function broadcastMessageUpdated(
  message: Message,
  conversationId: string,
  inboxId?: string
): void {
  broadcastRealtime({
    type: "message.updated",
    payload: { message, conversationId },
  });

  if (!inboxId) return;

  dispatchOutgoingWebhook(
    "message_updated",
    {
      id: message.id,
      conversation_id: conversationId,
      content: message.content,
      content_type: message.contentType,
      status: message.status,
      private: message.isPrivate,
      created_at: message.createdAt,
      source_id: message.externalId ?? null,
      sender: {
        id: message.senderId,
        name: message.senderName,
        type: message.senderType,
      },
    },
    inboxId
  );
}

export async function loadConversationForRealtime(
  conversationId: string
): Promise<ConversationRow | null> {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationRealtimeInclude,
  });
}

/** Emite message.created. Si ya tienes filas mapeables, pásalas para evitar queries extra. */
export async function emitMessageCreated(
  conversationId: string,
  messageId: string,
  preloaded?: {
    message?: MessageRow;
    conversation?: ConversationRow | null;
  }
): Promise<void> {
  const [message, conversation] = await Promise.all([
    preloaded?.message
      ? Promise.resolve(preloaded.message)
      : prisma.message.findUnique({
          where: { id: messageId },
          include: messageInclude,
        }),
    preloaded?.conversation !== undefined
      ? Promise.resolve(preloaded.conversation)
      : loadConversationForRealtime(conversationId),
  ]);

  if (!message || !conversation) return;

  broadcastMessageCreated(mapMessage(message), mapConversation(conversation));
}

export async function emitMessageUpdated(
  conversationId: string,
  messageId: string,
  preloadedMessage?: MessageRow
): Promise<void> {
  const [message, conversation] = await Promise.all([
    preloadedMessage
      ? Promise.resolve(preloadedMessage)
      : prisma.message.findUnique({
          where: { id: messageId },
          include: messageInclude,
        }),
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { inboxId: true },
    }),
  ]);

  if (!message) return;

  broadcastMessageUpdated(mapMessage(message), conversationId, conversation?.inboxId);
}

export async function emitConversationUpdated(conversationId: string): Promise<void> {
  const conversation = await loadConversationForRealtime(conversationId);
  if (!conversation) return;

  const mapped = mapConversation(conversation);

  broadcastRealtime({
    type: "conversation.updated",
    payload: {
      conversation: mapped,
    },
  });

  dispatchOutgoingWebhook(
    "conversation_updated",
    {
      ...(mapped as unknown as Record<string, unknown>),
    },
    mapped.inboxId
  );
}

export async function emitConversationCreated(conversationId: string): Promise<void> {
  const conversation = await loadConversationForRealtime(conversationId);
  if (!conversation) return;

  const mapped = mapConversation(conversation);
  dispatchOutgoingWebhook(
    "conversation_created",
    {
      ...(mapped as unknown as Record<string, unknown>),
    },
    mapped.inboxId
  );
}

export async function emitConversationStatusChanged(
  conversationId: string,
  previousStatus: string,
  nextStatus: string
): Promise<void> {
  if (previousStatus === nextStatus) return;

  const conversation = await loadConversationForRealtime(conversationId);
  if (!conversation) return;

  const mapped = mapConversation(conversation);
  dispatchOutgoingWebhook(
    "conversation_status_changed",
    {
      ...(mapped as unknown as Record<string, unknown>),
      changed_attributes: [
        {
          status: {
            previous_value: previousStatus,
            current_value: nextStatus,
          },
        },
      ],
    },
    mapped.inboxId
  );
}
