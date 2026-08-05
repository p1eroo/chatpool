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

const sortOrderCounters = new Map<string, number>();

export function seedSortOrderCounter(conversationId: string, maxSortOrder: number): void {
  if (maxSortOrder <= 0) return;
  const current = sortOrderCounters.get(conversationId) ?? 0;
  if (maxSortOrder > current) {
    sortOrderCounters.set(conversationId, maxSortOrder);
  }
}

/** Evita aggregate max en cada mensaje cuando el lock ya serializa la conversación. */
export async function reserveNextSortOrder(
  conversationId: string,
  client: PrismaClientLike = prisma
): Promise<number> {
  const cached = sortOrderCounters.get(conversationId);
  if (cached !== undefined) {
    const next = cached + 1;
    sortOrderCounters.set(conversationId, next);
    return next;
  }

  const result = await client.message.aggregate({
    where: { conversationId },
    _max: { sortOrder: true },
  });
  const next = (result._max.sortOrder ?? 0) + 1;
  sortOrderCounters.set(conversationId, next);
  return next;
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
  return reserveNextSortOrder(conversationId, client);
}

export async function nextMessageSortOrder(
  conversationId: string,
  client: PrismaClientLike = prisma
): Promise<number> {
  return reserveNextSortOrder(conversationId, client);
}

export type MessageCreateData = Prisma.MessageUncheckedCreateInput;
