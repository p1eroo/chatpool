import { prisma } from "../../infrastructure/database/prisma.client.js";

/**
 * Elige el agente del pool de autoasignación con menos conversaciones open.
 * Empate: createdAt más antiguo, luego agentId.
 */
export async function pickLeastLoadedAutoAssignAgent(
  inboxId: string
): Promise<string | null> {
  const settings = await prisma.inboxSettings.findUnique({
    where: { inboxId },
    select: { autoAssignEnabled: true },
  });
  if (!settings?.autoAssignEnabled) return null;

  const pool = await prisma.inboxAgent.findMany({
    where: {
      inboxId,
      autoAssign: true,
      agent: { active: true },
    },
    select: {
      agentId: true,
      agent: { select: { createdAt: true } },
    },
  });

  if (pool.length === 0) return null;

  const agentIds = pool.map((row) => row.agentId);
  const counts = await prisma.conversation.groupBy({
    by: ["assigneeId"],
    where: {
      inboxId,
      status: "open",
      assigneeId: { in: agentIds },
    },
    _count: { _all: true },
  });

  const countByAgent = new Map(
    counts.map((row) => [row.assigneeId as string, row._count._all])
  );

  let best: { agentId: string; count: number; createdAt: Date } | null = null;

  for (const row of pool) {
    const count = countByAgent.get(row.agentId) ?? 0;
    const createdAt = row.agent.createdAt;
    if (
      !best ||
      count < best.count ||
      (count === best.count && createdAt < best.createdAt) ||
      (count === best.count &&
        createdAt.getTime() === best.createdAt.getTime() &&
        row.agentId < best.agentId)
    ) {
      best = { agentId: row.agentId, count, createdAt };
    }
  }

  return best?.agentId ?? null;
}
