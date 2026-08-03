import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.client.js";

type PrismaClientLike = Pick<typeof prisma, "message">;

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
