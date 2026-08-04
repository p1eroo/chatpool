import type { Conversation, Message } from "../../types/api-responses.js";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { broadcastRealtime } from "../../infrastructure/realtime/realtime-hub.js";
import { mapConversation, mapMessage, messageInclude } from "../mappers.js";

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
}

export function broadcastMessageUpdated(message: Message, conversationId: string): void {
  broadcastRealtime({
    type: "message.updated",
    payload: { message, conversationId },
  });
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
  const message =
    preloadedMessage ??
    (await prisma.message.findUnique({
      where: { id: messageId },
      include: messageInclude,
    }));

  if (!message) return;

  broadcastMessageUpdated(mapMessage(message), conversationId);
}

export async function emitConversationUpdated(conversationId: string): Promise<void> {
  const conversation = await loadConversationForRealtime(conversationId);
  if (!conversation) return;

  broadcastRealtime({
    type: "conversation.updated",
    payload: {
      conversation: mapConversation(conversation),
    },
  });
}
