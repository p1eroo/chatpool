import { prisma } from "../../infrastructure/database/prisma.client.js";
import { ForbiddenError, NotFoundError } from "../../domain/errors.js";

export async function listInboxIdsForAgent(agentId: string): Promise<string[]> {
  const rows = await prisma.inboxAgent.findMany({
    where: { agentId },
    select: { inboxId: true },
  });
  return rows.map((row) => row.inboxId);
}

export async function assertAgentCanAccessInbox(agentId: string, inboxId: string): Promise<void> {
  const membership = await prisma.inboxAgent.findUnique({
    where: {
      inboxId_agentId: { inboxId, agentId },
    },
  });

  if (!membership) {
    throw new ForbiddenError("No tienes acceso a esta bandeja", "INBOX_ACCESS_DENIED");
  }
}

export async function assertAgentCanAccessConversation(
  agentId: string,
  conversationId: string
): Promise<{ inboxId: string }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { inboxId: true },
  });

  if (!conversation) {
    throw new NotFoundError("Conversación no encontrada");
  }

  await assertAgentCanAccessInbox(agentId, conversation.inboxId);
  return conversation;
}

export async function replaceAgentInboxAccess(agentId: string, inboxIds: string[]): Promise<void> {
  const uniqueInboxIds = [...new Set(inboxIds.map((id) => id.trim()).filter(Boolean))];

  if (uniqueInboxIds.length > 0) {
    const existing = await prisma.inbox.findMany({
      where: { id: { in: uniqueInboxIds } },
      select: { id: true },
    });
    if (existing.length !== uniqueInboxIds.length) {
      throw new NotFoundError("Una o más bandejas no existen");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.inboxAgent.deleteMany({ where: { agentId } });
    if (uniqueInboxIds.length > 0) {
      await tx.inboxAgent.createMany({
        data: uniqueInboxIds.map((inboxId) => ({ inboxId, agentId })),
      });
    }
  });
}
