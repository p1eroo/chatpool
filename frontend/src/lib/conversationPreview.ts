import type { Message } from "@/types";

/** Último mensaje visible en la lista de conversaciones (excluye actividad del sistema). */
export function pickLatestPreviewMessage(
  ...candidates: Array<Message | null | undefined>
): Message | null {
  const items = candidates.filter(
    (item): item is Message => Boolean(item) && item.senderType !== "system"
  );
  if (items.length === 0) return null;

  return items.reduce((latest, current) =>
    new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
  );
}

export function pickLatestPreviewFromMessages(messages: Message[]): Message | null {
  return pickLatestPreviewMessage(...messages);
}
