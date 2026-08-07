import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { recordConversationLabelActivity } from "../conversations/conversation-activity.service.js";
import {
  conversationRealtimeInclude,
  emitConversationUpdated,
} from "../realtime/realtime.service.js";
import { mapConversation } from "../mappers.js";

function normalizeLabelName(name: string): string {
  return name.trim().toLowerCase();
}

/** Lista nombres de etiquetas de una conversación (estilo Chatwoot payload). */
export async function listConversationLabelNames(conversationId: string): Promise<string[]> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  const rows = await prisma.conversationLabel.findMany({
    where: { conversationId },
    include: { label: { select: { name: true } } },
    orderBy: { label: { name: "asc" } },
  });

  return rows.map((row) => row.label.name);
}

/**
 * Reemplaza las etiquetas de una conversación por nombres (Chatwoot overwrite).
 * Crea la etiqueta en la bandeja si no existe (color por defecto).
 */
export async function setConversationLabelsByNames(params: {
  conversationId: string;
  labelNames: string[];
  actorAgentId?: string;
}) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
    select: { id: true, inboxId: true },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  const desired = [
    ...new Set(
      params.labelNames
        .map(normalizeLabelName)
        .filter((name) => name.length > 0)
    ),
  ];

  const inboxLabels = await prisma.label.findMany({
    where: { inboxId: conversation.inboxId },
  });
  const byName = new Map(inboxLabels.map((label) => [label.name, label]));

  for (const name of desired) {
    if (!byName.has(name)) {
      const created = await prisma.label.create({
        data: {
          inboxId: conversation.inboxId,
          name,
          color: "#6B7280",
        },
      });
      byName.set(name, created);
    }
  }

  const current = await prisma.conversationLabel.findMany({
    where: { conversationId: conversation.id },
    include: { label: true },
  });
  const currentByLabelId = new Map(current.map((row) => [row.labelId, row]));

  const desiredLabelIds = desired.map((name) => {
    const label = byName.get(name);
    if (!label) {
      throw new AppError(`No se pudo resolver la etiqueta "${name}"`, 500);
    }
    return label.id;
  });
  const desiredSet = new Set(desiredLabelIds);

  for (const row of current) {
    if (!desiredSet.has(row.labelId)) {
      await prisma.conversationLabel.delete({
        where: {
          conversationId_labelId: {
            conversationId: conversation.id,
            labelId: row.labelId,
          },
        },
      });
      await recordConversationLabelActivity({
        conversationId: conversation.id,
        labelName: row.label.name,
        added: false,
        actorAgentId: params.actorAgentId,
      });
    }
  }

  for (const labelId of desiredLabelIds) {
    if (currentByLabelId.has(labelId)) continue;
    const label = [...byName.values()].find((item) => item.id === labelId);
    await prisma.conversationLabel.create({
      data: { conversationId: conversation.id, labelId },
    });
    await recordConversationLabelActivity({
      conversationId: conversation.id,
      labelName: label?.name ?? labelId,
      added: true,
      actorAgentId: params.actorAgentId,
    });
  }

  await emitConversationUpdated(conversation.id);

  const updated = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    include: conversationRealtimeInclude,
  });
  if (!updated) throw new NotFoundError("Conversación no encontrada");

  return {
    conversation: mapConversation(updated),
    payload: desired,
  };
}
