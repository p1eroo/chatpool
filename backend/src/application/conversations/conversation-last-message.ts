import { prisma } from "../../infrastructure/database/prisma.client.js";

export async function touchConversationLastMessageAt(
  conversationId: string,
  at: Date
): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: at },
  });
}

export async function refreshConversationLastMessageAt(
  conversationId: string
): Promise<void> {
  const latest = await prisma.message.findFirst({
    where: {
      conversationId,
      senderType: { not: "system" },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: latest?.createdAt ?? null },
  });
}
