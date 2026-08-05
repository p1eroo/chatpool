import { prisma } from "../../infrastructure/database/prisma.client.js";
import type { Prisma } from "@prisma/client";
import { mapConversation, mapMessage, messageInclude } from "../mappers.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import type {
  SendMessageBody,
  SendTemplateBody,
  UpdateConversationBody,
} from "../../types/api-responses.js";
import { getLastContactMessageAt, isReplyWindowOpen } from "../../shared/whatsapp-window.js";
import {
  broadcastMessageCreated,
  conversationRealtimeInclude,
  emitConversationUpdated,
} from "../realtime/realtime.service.js";
import { uploadConversationMedia } from "../media/media-storage.service.js";
import { normalizeAudioForWhatsApp } from "../media/audio-transcode.service.js";
import {
  assertAgentCanAccessInbox,
  listInboxIdsForAgent,
} from "../inboxes/inbox-access.service.js";
import {
  assertTemplateParameters,
  buildTemplatePreview,
  findApprovedTemplate,
} from "../whatsapp/whatsapp-templates.service.js";
import type { WhatsAppTemplateSendComponent } from "../../infrastructure/meta/meta-api.client.js";
import {
  recordConversationAssigneeActivity,
  recordConversationAutoReopenedActivity,
  recordConversationLabelActivity,
  recordConversationStatusActivity,
} from "./conversation-activity.service.js";
import { refreshConversationLastMessageAt } from "./conversation-last-message.js";
import { runWithConversationMessageLock } from "./conversation-message-serializer.js";
import { nextMessageSortOrder } from "./message-sort-order.js";
import {
  buildTemplateDeliveryPayload,
  scheduleWhatsAppMessageDelivery,
} from "./message-delivery.service.js";

const conversationInclude = conversationRealtimeInclude;

/** Asigna la conversación al agente que responde, si aún no tiene assignee. */
function shouldAutoAssignOnReply(
  assigneeId: string | null,
  isPrivate: boolean | undefined
): boolean {
  return !isPrivate && !assigneeId;
}

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

  if (filters.agentId) {
    if (filters.inboxId) {
      await assertAgentCanAccessInbox(filters.agentId, filters.inboxId);
      where.inboxId = filters.inboxId;
    } else {
      const accessibleInboxIds = await listInboxIdsForAgent(filters.agentId);
      if (accessibleInboxIds.length === 0) return [];
      where.inboxId = { in: accessibleInboxIds };
    }
  } else if (filters.inboxId) {
    where.inboxId = filters.inboxId;
  }

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
  _options?: { mediaBuffer?: Buffer }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      assigneeId: true,
      contact: { select: { isBlocked: true } },
      inbox: { select: { channelType: true } },
    },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  if (conversation.contact.isBlocked) {
    throw new AppError(
      "Este contacto está bloqueado. Desbloquéalo para enviar mensajes.",
      422,
      "CONTACT_BLOCKED"
    );
  }

  const needsWhatsAppWindow =
    !body.isPrivate && conversation.inbox.channelType === "whatsapp";
  const needsWhatsAppDelivery = needsWhatsAppWindow;
  const clientMessageId = body.clientMessageId?.trim() || null;

  const [lastContactAt, agent, replyTarget, existingByClientId] = await Promise.all([
    needsWhatsAppWindow ? getLastContactMessageAt(conversationId) : Promise.resolve(null),
    prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, name: true } }),
    resolveReplyTarget(conversationId, body.replyToMessageId),
    clientMessageId
      ? prisma.message.findFirst({
          where: { conversationId, clientMessageId },
          include: messageInclude,
        })
      : Promise.resolve(null),
  ]);

  if (!agent) throw new NotFoundError("Agente no encontrado");

  if (needsWhatsAppWindow && !isReplyWindowOpen(lastContactAt)) {
    throw new AppError(
      "La ventana de mensajes de 24 horas está cerrada. Envía una plantilla aprobada.",
      422,
      "WHATSAPP_WINDOW_CLOSED"
    );
  }

  if (existingByClientId) {
    const mapped = mapMessage(existingByClientId);
    if (existingByClientId.status === "pending") {
      scheduleWhatsAppMessageDelivery(conversationId, mapped.id);
    }
    return mapped;
  }

  const autoAssign = shouldAutoAssignOnReply(conversation.assigneeId, body.isPrivate);
  const previousAssigneeId = conversation.assigneeId;
  const createdAt = new Date();

  const result = await runWithConversationMessageLock(conversationId, async () => {
    if (clientMessageId) {
      const raced = await prisma.message.findFirst({
        where: { conversationId, clientMessageId },
        include: messageInclude,
      });
      if (raced) {
        return { message: raced, scheduleDelivery: raced.status === "pending" };
      }
    }

    const sortOrder = await nextMessageSortOrder(conversationId);

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
        mediaExternalId: null,
        externalId: null,
        replyToMessageId: replyTarget?.id ?? null,
        clientMessageId,
        status: needsWhatsAppDelivery ? "pending" : "sent",
        sortOrder,
        createdAt,
      },
      include: messageInclude,
    });

    const conversationForEmit = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: createdAt,
        ...(autoAssign ? { assigneeId: agentId } : {}),
      },
      include: conversationInclude,
    });

    broadcastMessageCreated(mapMessage(message), mapConversation(conversationForEmit));

    return {
      message,
      scheduleDelivery: needsWhatsAppDelivery,
    };
  });

  if (result.scheduleDelivery) {
    scheduleWhatsAppMessageDelivery(conversationId, result.message.id);
  }

  if (autoAssign) {
    void recordConversationAssigneeActivity({
      conversationId,
      previousAssigneeId,
      nextAssigneeId: agentId,
      actorAgentId: agentId,
    });
  }

  return mapMessage(result.message);
}

export async function sendAgentMessageWithFile(
  conversationId: string,
  agentId: string,
  params: {
    content: string;
    isPrivate?: boolean;
    contentType: "image" | "file" | "audio" | "sticker";
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    replyToMessageId?: string;
    clientMessageId?: string;
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
      clientMessageId: params.clientMessageId,
    }
  );
}

/** Envía una plantilla aprobada de WhatsApp vía Meta Cloud API. */
export async function sendWhatsAppTemplate(
  conversationId: string,
  agentId: string,
  body: SendTemplateBody
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      inboxId: true,
      assigneeId: true,
      contact: { select: { isBlocked: true } },
      inbox: { select: { channelType: true } },
    },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  if (conversation.inbox.channelType !== "whatsapp") {
    throw new AppError("Las plantillas solo aplican a conversaciones de WhatsApp", 422);
  }

  if (conversation.contact.isBlocked) {
    throw new AppError(
      "Este contacto está bloqueado. Desbloquéalo para enviar mensajes.",
      422,
      "CONTACT_BLOCKED"
    );
  }

  const templateName = body.templateName.trim();
  const language = body.language.trim();
  if (!templateName || !language) {
    throw new AppError("Nombre e idioma de plantilla son obligatorios", 422);
  }

  const clientMessageId = body.clientMessageId?.trim() || null;

  const [agent, template, existingByClientId] = await Promise.all([
    prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, name: true } }),
    findApprovedTemplate(conversation.inboxId, templateName, language),
    clientMessageId
      ? prisma.message.findFirst({
          where: { conversationId, clientMessageId },
          include: messageInclude,
        })
      : Promise.resolve(null),
  ]);

  if (!agent) throw new NotFoundError("Agente no encontrado");

  if (existingByClientId) {
    const mapped = mapMessage(existingByClientId);
    if (existingByClientId.status === "pending") {
      scheduleWhatsAppMessageDelivery(conversationId, mapped.id);
    }
    return mapped;
  }

  const bodyParameters = body.bodyParameters ?? [];
  const headerParameters = body.headerParameters ?? [];
  const buttonUrlParameters = body.buttonUrlParameters ?? [];

  assertTemplateParameters(template, {
    bodyParameters,
    headerParameters,
    buttonUrlParameters,
  });

  const components: WhatsAppTemplateSendComponent[] = [];
  if (headerParameters.length) {
    components.push({
      type: "header",
      parameters: headerParameters.map((text) => ({ type: "text", text })),
    });
  }
  if (bodyParameters.length) {
    components.push({
      type: "body",
      parameters: bodyParameters.map((text) => ({ type: "text", text })),
    });
  }
  for (const button of buttonUrlParameters) {
    components.push({
      type: "button",
      sub_type: "url",
      index: String(button.index),
      parameters: [{ type: "text", text: button.text }],
    });
  }

  const content = buildTemplatePreview(template, {
    bodyParameters,
    headerParameters,
  });

  const deliveryPayload = buildTemplateDeliveryPayload({
    name: template.name,
    language: template.language,
    components: components.length ? components : undefined,
  });

  const autoAssign = shouldAutoAssignOnReply(conversation.assigneeId, false);
  const previousAssigneeId = conversation.assigneeId;
  const createdAt = new Date();

  const result = await runWithConversationMessageLock(conversationId, async () => {
    if (clientMessageId) {
      const raced = await prisma.message.findFirst({
        where: { conversationId, clientMessageId },
        include: messageInclude,
      });
      if (raced) {
        return { message: raced, scheduleDelivery: raced.status === "pending" };
      }
    }

    const sortOrder = await nextMessageSortOrder(conversationId);

    const message = await prisma.message.create({
      data: {
        conversationId,
        content,
        senderType: "agent",
        senderAgentId: agentId,
        senderName: agent.name,
        isPrivate: false,
        contentType: "text",
        externalId: null,
        clientMessageId,
        deliveryPayload: deliveryPayload as unknown as Prisma.InputJsonValue,
        status: "pending",
        sortOrder,
        createdAt,
      },
      include: messageInclude,
    });

    const conversationForEmit = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: createdAt,
        ...(autoAssign ? { assigneeId: agentId } : {}),
      },
      include: conversationInclude,
    });

    broadcastMessageCreated(mapMessage(message), mapConversation(conversationForEmit));

    return {
      message,
      scheduleDelivery: true,
    };
  });

  if (result.scheduleDelivery) {
    scheduleWhatsAppMessageDelivery(conversationId, result.message.id);
  }

  if (autoAssign) {
    void recordConversationAssigneeActivity({
      conversationId,
      previousAssigneeId,
      nextAssigneeId: agentId,
      actorAgentId: agentId,
    });
  }

  return mapMessage(result.message);
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

  if (body.assigneeId) {
    const membership = await prisma.inboxAgent.findUnique({
      where: {
        inboxId_agentId: {
          inboxId: conversation.inboxId,
          agentId: body.assigneeId,
        },
      },
    });
    if (!membership) {
      throw new AppError(
        "El agente no tiene acceso a esta bandeja",
        422,
        "AGENT_NOT_IN_INBOX"
      );
    }
  }

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
}) {
  const result = await prisma.$transaction(async (tx) => {
    // Serializa webhooks concurrentes del mismo contacto (evita 2 "open").
    await tx.$executeRaw`SELECT id FROM contacts WHERE id = ${params.contactId} FOR UPDATE`;

    const open = await tx.conversation.findFirst({
      where: {
        inboxId: params.inboxId,
        contactId: params.contactId,
        status: "open",
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    });

    if (open) {
      return { conversation: open, reopened: false as const };
    }

    const resolved = await tx.conversation.findFirst({
      where: {
        inboxId: params.inboxId,
        contactId: params.contactId,
        status: "resolved",
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    });

    if (resolved) {
      const conversation = await tx.conversation.update({
        where: { id: resolved.id },
        data: { status: "open" },
      });
      return { conversation, reopened: true as const };
    }

    const conversation = await tx.conversation.create({
      data: {
        inboxId: params.inboxId,
        contactId: params.contactId,
        assigneeId: null,
        status: "open",
        priority: "none",
        unreadCount: 0,
      },
    });

    return { conversation, reopened: false as const };
  });

  if (result.reopened) {
    await emitConversationUpdated(result.conversation.id);
    await recordConversationAutoReopenedActivity(result.conversation.id);
  }

  return { conversation: result.conversation, reopened: result.reopened };
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
