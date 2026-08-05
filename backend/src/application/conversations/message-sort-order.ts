import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.client.js";

type PrismaClientLike = Pick<typeof prisma, "message">;

const META_SORT_INDEX_CAP = 999;

export function metaTimestampSortBase(timestamp?: string): number | null {
  if (!timestamp) return null;
  const seconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds * 1000;
}

/** Orden preferido por timestamp Meta + índice en batch; monótono respecto al chat. */
export async function computeInboundMessageSortOrder(
  conversationId: string,
  metaTimestamp: string | undefined,
  batchIndex: number,
  client: PrismaClientLike = prisma
): Promise<number> {
  const cappedIndex = Math.min(Math.max(batchIndex, 0), META_SORT_INDEX_CAP);
  const base = metaTimestampSortBase(metaTimestamp);

  const result = await client.message.aggregate({
    where: { conversationId },
    _max: { sortOrder: true },
  });
  const currentMax = result._max.sortOrder ?? 0;

  if (base == null) {
    return currentMax + 1;
  }

  const preferred = base + cappedIndex;
  if (preferred > currentMax) {
    return preferred;
  }

  return currentMax + 1;
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
