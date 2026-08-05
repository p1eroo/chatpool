import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.client.js";

type PrismaClientLike = Pick<typeof prisma, "message">;

/** Segundos Unix de Meta (solo para ordenar la cola en memoria, no para DB). */
export function metaTimestampSortBase(timestamp?: string): number | null {
  if (!timestamp) return null;
  const seconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds;
}

/**
 * sort_order en Postgres es INTEGER (max ~2.1e9); no cabe timestamp×1000.
 * El orden en ráfaga lo garantiza la cola FIFO por contacto → max+1 basta.
 */
export async function computeInboundMessageSortOrder(
  conversationId: string,
  _metaTimestamp?: string,
  _batchIndex?: number,
  client: PrismaClientLike = prisma
): Promise<number> {
  return nextMessageSortOrder(conversationId, client);
}

export async function nextMessageSortOrder(
  conversationId: string,
  client: PrismaClientLike = prisma
): Promise<number> {
  const result = await client.message.aggregate({
    where: { conversationId },
    _max: { sortOrder: true },
  });

  return (result._max.sortOrder ?? 0) + 1;
}

export type MessageCreateData = Prisma.MessageUncheckedCreateInput;
