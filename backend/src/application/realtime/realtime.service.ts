import { prisma } from "../../infrastructure/database/prisma.client.js";
import { broadcastRealtime } from "../../infrastructure/realtime/realtime-hub.js";
import { mapConversation, mapMessage, messageInclude } from "../mappers.js";

const conversationPreviewMessages = {
  where: { senderType: { not: "system" as const } },
  orderBy: [{ sortOrder: "desc" as const }, { createdAt: "desc" as const }],
  take: 1,
  include: messageInclude,
};

const conversationInclude = {
  contact: true,
  assignee: true,
  inbox: true,
  labels: { include: { label: true } },
  messages: conversationPreviewMessages,
};

export async function emitMessageCreated(
  conversationId: string,
  messageId: string
): Promise<void> {
  const [message, conversation] = await Promise.all([
    prisma.message.findUnique({
      where: { id: messageId },
      include: messageInclude,
    }),
    prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    }),
  ]);

  if (!message || !conversation) return;

  broadcastRealtime({
    type: "message.created",
    payload: {
      message: mapMessage(message),
      conversation: mapConversation(conversation),
    },
  });
}

export async function emitMessageUpdated(
  conversationId: string,
  messageId: string
): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: messageInclude,
  });

  if (!message) return;

  broadcastRealtime({
    type: "message.updated",
    payload: {
      message: mapMessage(message),
      conversationId,
    },
  });
}

export async function emitConversationUpdated(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conversation) return;

  broadcastRealtime({
    type: "conversation.updated",
    payload: {
      conversation: mapConversation(conversation),
    },
  });
}
