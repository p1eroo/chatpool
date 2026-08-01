import { prisma } from "../../infrastructure/database/prisma.client.js";
import { mapConversation, mapMessage, messageInclude } from "../mappers.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import type {
  SendMessageBody,
  SendTemplateBody,
  UpdateConversationBody,
} from "../../types/api-responses.js";
import { getLastContactMessageAt, isReplyWindowOpen } from "../../shared/whatsapp-window.js";
import {
  emitConversationUpdated,
  emitMessageCreated,
} from "../realtime/realtime.service.js";
import { uploadConversationMedia } from "../media/media-storage.service.js";
import { deliverWhatsAppOutbound } from "../media/meta-outbound.service.js";

const conversationInclude = {
  contact: true,
  assignee: true,
  inbox: true,
  labels: { include: { label: true } },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: messageInclude,
  },
};

async function resolveReplyTarget(conversationId: string, replyToMessageId?: string) {
  if (!replyToMessageId) return null;

  const target = await prisma.message.findFirst({
    where: {
      id: replyToMessageId,
      conversationId,
    },
    select: {
      id: true,
      externalId: true,
    },
  });

  if (!target) {
    throw new NotFoundError("El mensaje al que intentas responder no existe en esta conversación");
  }

  return target;
}

export async function listConversations(filters: {
  inboxId?: string;
  status?: string;
  assignee?: "mine" | "unassigned" | "all";
  agentId?: string;
  labelId?: string;
}) {
  const where: Record<string, unknown> = {};

  if (filters.inboxId) where.inboxId = filters.inboxId;
  if (filters.status && filters.status !== "all") where.status = filters.status;

  if (filters.assignee === "mine" && filters.agentId) {
    where.assigneeId = filters.agentId;
  } else if (filters.assignee === "unassigned") {
    where.assigneeId = null;
  }

  if (filters.labelId) {
    where.labels = { some: { labelId: filters.labelId } };
  }

  const rows = await prisma.conversation.findMany({
    where,
    include: conversationInclude,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map(mapConversation);
}

export async function getConversationMessages(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: messageInclude,
  });

  return messages.map(mapMessage);
}

export async function markConversationRead(conversationId: string) {
  const conversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
    select: {
      id: true,
      contact: { select: { name: true, phone: true } },
      inbox: { select: { name: true } },
    },
  });

  await emitConversationUpdated(conversationId);

  return {
    conversationId: conversation.id,
    contactName: conversation.contact.name,
    contactPhone: conversation.contact.phone,
    inboxName: conversation.inbox.name,
  };
}

export async function sendAgentMessage(
  conversationId: string,
  agentId: string,
  body: SendMessageBody,
  options?: { mediaBuffer?: Buffer }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { assignee: true, inbox: true, contact: true },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  if (!body.isPrivate && conversation.inbox.channelType === "whatsapp") {
    const lastContactAt = await getLastContactMessageAt(conversationId);
    if (!isReplyWindowOpen(lastContactAt)) {
      throw new AppError(
        "La ventana de mensajes de 24 horas está cerrada. Envía una plantilla aprobada.",
        422,
        "WHATSAPP_WINDOW_CLOSED"
      );
    }
  }

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new NotFoundError("Agente no encontrado");

  const replyTarget = await resolveReplyTarget(conversationId, body.replyToMessageId);

  let externalId: string | null = null;
  let mediaExternalId: string | null = null;

  if (!body.isPrivate && conversation.inbox.channelType === "whatsapp") {
    const delivered = await deliverWhatsAppOutbound({
      inboxId: conversation.inboxId,
      recipientWaId: conversation.contact.waId,
      recipientPhone: conversation.contact.phone,
      contentType: body.contentType ?? "text",
      content: body.content,
      fileName: body.fileName,
      mimeType: body.mimeType,
      mediaBuffer: options?.mediaBuffer,
      replyToExternalId: replyTarget?.externalId,
    });
    externalId = delivered.externalId;
    mediaExternalId = delivered.mediaExternalId ?? null;
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      content: body.content,
      senderType: "agent",
      senderAgentId: agentId,
      senderName: agent.name,
      isPrivate: body.isPrivate ?? false,
      contentType: body.contentType ?? "text",
      fileName: body.fileName ?? null,
      fileSize: body.fileSize ?? null,
      fileKey: body.fileKey ?? null,
      mimeType: body.mimeType ?? null,
      mediaExternalId,
      externalId,
      replyToMessageId: replyTarget?.id ?? null,
      status: "sent",
    },
    include: messageInclude,
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  await emitMessageCreated(conversationId, message.id);

  return mapMessage(message);
}

export async function sendAgentMessageWithFile(
  conversationId: string,
  agentId: string,
  params: {
    content: string;
    isPrivate?: boolean;
    contentType: "image" | "file" | "audio";
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    replyToMessageId?: string;
  }
) {
  let stored;
  try {
    stored = await uploadConversationMedia({
      conversationId,
      buffer: params.buffer,
      originalName: params.originalName,
      mimeType: params.mimeType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo subir el archivo";
    throw new AppError(message, 503, "STORAGE_UNAVAILABLE");
  }

  return sendAgentMessage(
    conversationId,
    agentId,
    {
      content: params.content.trim() || stored.fileName,
      isPrivate: params.isPrivate,
      contentType: params.contentType,
      fileName: stored.fileName,
      fileSize: stored.fileSize,
      fileKey: stored.fileKey,
      mimeType: stored.mimeType,
      replyToMessageId: params.replyToMessageId,
    },
    { mediaBuffer: params.buffer }
  );
}

/** Simula envío de plantilla Meta (integración real en fase Meta). */
export async function sendWhatsAppTemplate(
  conversationId: string,
  agentId: string,
  body: SendTemplateBody
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { inbox: true },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  if (conversation.inbox.channelType !== "whatsapp") {
    throw new AppError("Las plantillas solo aplican a conversaciones de WhatsApp", 422);
  }

  if (body.templateId === "demo_fail") {
    throw new AppError(
      "Meta rechazó el envío de la plantilla. Revisa el nombre, idioma o parámetros.",
      502,
      "META_TEMPLATE_FAILED"
    );
  }

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new NotFoundError("Agente no encontrado");

  const message = await prisma.message.create({
    data: {
      conversationId,
      content: body.content,
      senderType: "agent",
      senderAgentId: agentId,
      senderName: agent.name,
      isPrivate: false,
      contentType: "text",
      status: "sent",
    },
    include: {
      senderAgent: { select: { name: true } },
      senderContact: { select: { name: true } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  await emitMessageCreated(conversationId, message.id);

  return mapMessage(message);
}

export async function updateConversation(
  conversationId: string,
  body: UpdateConversationBody
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: body.status,
      assigneeId: body.assigneeId,
      unreadCount: body.unreadCount,
    },
    include: conversationInclude,
  });

  await emitConversationUpdated(conversationId);

  return mapConversation(updated);
}

export async function deleteConversation(conversationId: string) {
  await prisma.conversation.delete({ where: { id: conversationId } });
}

export async function deleteMessage(conversationId: string, messageId: string) {
  await prisma.message.deleteMany({
    where: { id: messageId, conversationId },
  });
}

export async function toggleConversationLabel(conversationId: string, labelId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  const label = await prisma.label.findUnique({
    where: { id: labelId },
  });
  if (!label) throw new NotFoundError("Etiqueta no encontrada");

  if (label.inboxId !== conversation.inboxId) {
    throw new AppError("La etiqueta no pertenece a la bandeja de esta conversación", 422);
  }

  const existing = await prisma.conversationLabel.findUnique({
    where: {
      conversationId_labelId: { conversationId, labelId },
    },
  });

  if (existing) {
    await prisma.conversationLabel.delete({
      where: {
        conversationId_labelId: { conversationId, labelId },
      },
    });
  } else {
    await prisma.conversationLabel.create({
      data: { conversationId, labelId },
    });
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
    include: conversationInclude,
  });

  await emitConversationUpdated(conversationId);

  return mapConversation(updated);
}
