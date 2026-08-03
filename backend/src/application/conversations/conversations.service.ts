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
import { normalizeAudioForWhatsApp } from "../media/audio-transcode.service.js";
import {
  recordConversationAssigneeActivity,
  recordConversationAutoReopenedActivity,
  recordConversationLabelActivity,
  recordConversationStatusActivity,
} from "./conversation-activity.service.js";
import { touchConversationLastMessageAt, refreshConversationLastMessageAt } from "./conversation-last-message.js";
import { runWithConversationMessageLock } from "./conversation-message-serializer.js";
import { nextMessageSortOrder } from "./message-sort-order.js";

const conversationPreviewMessages = {
  where: { senderType: { not: "system" as const } },
  orderBy: [{ sortOrder: "desc" as const }, { createdAt: "desc" as const }],
  take: 1,
  include: messageInclude,
};

const conversationInclude = {
  contact: true,
  assignee: true,
  inbox: true,
  labels: { include: { label: true } },
  messages: conversationPreviewMessages,
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
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
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
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { externalId: "asc" }],
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
  return runWithConversationMessageLock(conversationId, async () => {
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
      let mediaBuffer = options?.mediaBuffer;
      let mimeType = body.mimeType ?? null;
      let fileName = body.fileName ?? null;

      if (body.contentType === "audio" && mediaBuffer?.length) {
        const normalized = await normalizeAudioForWhatsApp(
          mediaBuffer,
          mimeType ?? "audio/webm",
          fileName ?? "voice.webm"
        );
        mediaBuffer = normalized.buffer;
        mimeType = normalized.mimeType;
        fileName = normalized.fileName;
      }

      const delivered = await deliverWhatsAppOutbound({
        inboxId: conversation.inboxId,
        recipientWaId: conversation.contact.waId,
        recipientPhone: conversation.contact.phone,
        contentType: body.contentType ?? "text",
        content: body.content,
        fileName,
        mimeType,
        mediaBuffer,
        replyToExternalId: replyTarget?.externalId,
      });
      externalId = delivered.externalId;
      mediaExternalId = delivered.mediaExternalId ?? null;
    }

    const sortOrder = await nextMessageSortOrder(conversationId);
    const createdAt = new Date();

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
        sortOrder,
        createdAt,
      },
      include: messageInclude,
    });

    await touchConversationLastMessageAt(conversationId, createdAt);

    await emitMessageCreated(conversationId, message.id);

    return mapMessage(message);
  });
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
  let buffer = params.buffer;
  let mimeType = params.mimeType;
  let originalName = params.originalName;

  if (params.contentType === "audio") {
    const normalized = await normalizeAudioForWhatsApp(buffer, mimeType, originalName);
    buffer = normalized.buffer;
    mimeType = normalized.mimeType;
    originalName = normalized.fileName;
  }

  let stored;
  try {
    stored = await uploadConversationMedia({
      conversationId,
      buffer,
      originalName,
      mimeType,
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
    { mediaBuffer: buffer }
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

  return runWithConversationMessageLock(conversationId, async () => {
    const sortOrder = await nextMessageSortOrder(conversationId);
    const createdAt = new Date();

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
        sortOrder,
        createdAt,
      },
      include: messageInclude,
    });

    await touchConversationLastMessageAt(conversationId, createdAt);

    await emitMessageCreated(conversationId, message.id);

    return mapMessage(message);
  });
}

export async function updateConversation(
  conversationId: string,
  body: UpdateConversationBody,
  actorAgentId?: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  const data: {
    status?: UpdateConversationBody["status"];
    assigneeId?: string | null;
    unreadCount?: number;
  } = {};

  if (body.status !== undefined) data.status = body.status;
  if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId;
  if (body.unreadCount !== undefined) data.unreadCount = body.unreadCount;

  if (Object.keys(data).length === 0) {
    throw new AppError("No hay campos para actualizar", 400, "INVALID_UPDATE");
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data,
    include: conversationInclude,
  });

  if (body.status !== undefined) {
    await recordConversationStatusActivity({
      conversationId,
      previousStatus: conversation.status,
      nextStatus: body.status,
      actorAgentId,
    });
  }

  if (body.assigneeId !== undefined) {
    await recordConversationAssigneeActivity({
      conversationId,
      previousAssigneeId: conversation.assigneeId,
      nextAssigneeId: body.assigneeId,
      actorAgentId,
    });
  }

  await emitConversationUpdated(conversationId);

  return mapConversation(updated);
}

export async function findOrReopenConversationForContact(params: {
  inboxId: string;
  contactId: string;
  defaultAssigneeId: string | null;
}) {
  const open = await prisma.conversation.findFirst({
    where: {
      inboxId: params.inboxId,
      contactId: params.contactId,
      status: "open",
    },
  });

  if (open) {
    return { conversation: open, reopened: false };
  }

  const resolved = await prisma.conversation.findFirst({
    where: {
      inboxId: params.inboxId,
      contactId: params.contactId,
      status: "resolved",
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
  });

  if (resolved) {
    const conversation = await prisma.conversation.update({
      where: { id: resolved.id },
      data: {
        status: "open",
      },
    });

    await emitConversationUpdated(conversation.id);

    await recordConversationAutoReopenedActivity(conversation.id);

    return { conversation, reopened: true };
  }

  const conversation = await prisma.conversation.create({
    data: {
      inboxId: params.inboxId,
      contactId: params.contactId,
      assigneeId: params.defaultAssigneeId,
      status: "open",
      priority: "none",
      unreadCount: 0,
    },
  });

  return { conversation, reopened: false };
}

export async function deleteConversation(conversationId: string) {
  await prisma.conversation.delete({ where: { id: conversationId } });
}

export async function deleteMessage(conversationId: string, messageId: string) {
  await prisma.message.deleteMany({
    where: { id: messageId, conversationId },
  });

  await refreshConversationLastMessageAt(conversationId);
}

export async function toggleConversationLabel(
  conversationId: string,
  labelId: string,
  actorAgentId?: string
) {
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

  await recordConversationLabelActivity({
    conversationId,
    labelName: label.name,
    added: !existing,
    actorAgentId,
  });

  const updated = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!updated) throw new NotFoundError("Conversación no encontrada");

  await emitConversationUpdated(conversationId);

  return mapConversation(updated);
}
