const WHATSAPP_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isReplyWindowOpen(lastContactMessageAt: Date | null, now = new Date()): boolean {
  if (!lastContactMessageAt) return false;
  return now.getTime() - lastContactMessageAt.getTime() < WHATSAPP_REPLY_WINDOW_MS;
}

export async function getLastContactMessageAt(conversationId: string): Promise<Date | null> {
  const { prisma } = await import("../infrastructure/database/prisma.client.js");

  const message = await prisma.message.findFirst({
    where: {
      conversationId,
      senderType: "contact",
      isPrivate: false,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return message?.createdAt ?? null;
}
