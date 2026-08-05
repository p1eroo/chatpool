const WHATSAPP_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
const CONTACT_MESSAGE_AT_CACHE_TTL_MS = 60_000;

const contactMessageAtCache = new Map<
  string,
  { at: Date | null; cachedAt: number }
>();

export function isReplyWindowOpen(lastContactMessageAt: Date | null, now = new Date()): boolean {
  if (!lastContactMessageAt) return false;
  return now.getTime() - lastContactMessageAt.getTime() < WHATSAPP_REPLY_WINDOW_MS;
}

/** Invalida/actualiza la caché de ventana 24h tras un mensaje entrante del contacto. */
export function noteContactMessageAt(conversationId: string, at: Date): void {
  contactMessageAtCache.set(conversationId, { at, cachedAt: Date.now() });
}

export async function getLastContactMessageAt(conversationId: string): Promise<Date | null> {
  const cached = contactMessageAtCache.get(conversationId);
  if (cached && Date.now() - cached.cachedAt < CONTACT_MESSAGE_AT_CACHE_TTL_MS) {
    return cached.at;
  }

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

  const at = message?.createdAt ?? null;
  contactMessageAtCache.set(conversationId, { at, cachedAt: Date.now() });
  return at;
}
