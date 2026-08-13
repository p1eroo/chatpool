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
  emitConversationCreated,
  emitConversationStatusChanged,
  emitConversationUpdated,
} from "../realtime/realtime.service.js";
import {
  agentNameSelect,
  conversationMessageEmitSelect,
  conversationSendContextSelect,
  mapConversationMessageEmit,
  messageCreateInclude,
} from "../realtime/conversation-realtime-emit.js";
import { uploadConversationMedia } from "../media/media-storage.service.js";
import { normalizeAudioForWhatsApp } from "../media/audio-transcode.service.js";
import { buildLinkPreviewPayloadFromBody, scheduleLinkPreviewEnrichment } from "../link-preview/link-preview-enrichment.service.js";
import {
  assertAgentCanAccessInbox,
  listInboxIdsForAgent,
} from "../inboxes/inbox-access.service.js";
import { pickLeastLoadedAutoAssignAgent } from "../inboxes/auto-assign.service.js";
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
import { reserveNextSortOrder } from "./message-sort-order.js";
import {
  buildTemplateDeliveryPayload,
  scheduleWhatsAppMessageDelivery,
} from "./message-delivery.service.js";
import {
  BOT_PAUSE_MINUTES_MAX,
  BOT_PAUSE_MINUTES_MIN,
  DEFAULT_BOT_PAUSE_MINUTES,
  nextBotPausedUntil,
} from "../../shared/bot-pause.js";
import { normalizeRequestContactInfoBody, MISSING_WHATSAPP_PHONE_NOTE } from "../../shared/whatsapp-shared-contact.js";

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

export async function getConversationById(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");
  return mapConversation(conversation);
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
  options?: {
    mediaBuffer?: Buffer;
    senderType?: "agent" | "bot";
    deliveryPayload?: Prisma.InputJsonValue;
  }
) {
  const senderType = options?.senderType ?? "agent";
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: conversationSendContextSelect,
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
  // Bot (Application API / n8n): no auto-asignar al actor de API.
  const willAutoAssign =
    senderType === "agent" &&
    shouldAutoAssignOnReply(conversation.assigneeId, body.isPrivate);

  const [lastContactAt, agent, replyTarget, existingByClientId, assigneeForEmit] =
    await Promise.all([
      needsWhatsAppWindow ? getLastContactMessageAt(conversationId) : Promise.resolve(null),
      prisma.agent.findUnique({ where: { id: agentId }, select: agentNameSelect }),
      resolveReplyTarget(conversationId, body.replyToMessageId),
      clientMessageId
        ? prisma.message.findFirst({
            where: { conversationId, clientMessageId },
            include: messageInclude,
          })
        : Promise.resolve(null),
      willAutoAssign
        ? prisma.agent.findUnique({
            where: { id: agentId },
            select: conversationMessageEmitSelect.assignee.select,
          })
        : Promise.resolve(null),
    ]);

  if (!agent) throw new NotFoundError("Agente no encontrado");

  if (body.isPrivate && body.content.trim() === MISSING_WHATSAPP_PHONE_NOTE) {
    const existingNote = await prisma.message.findFirst({
      where: {
        conversationId,
        isPrivate: true,
        content: MISSING_WHATSAPP_PHONE_NOTE,
      },
      include: messageInclude,
    });
    if (existingNote) return mapMessage(existingNote);
  }

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

  const autoAssign = willAutoAssign;
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

    const sortOrder = await reserveNextSortOrder(conversationId);
    const linkPreviewPayload = buildLinkPreviewPayloadFromBody(
      body.linkPreview,
      body.content,
      body.suppressLinkPreview
    );

    const message = await prisma.message.create({
      data: {
        conversationId,
        content: body.content,
        senderType,
        senderAgentId: agentId,
        senderName: senderType === "bot" ? "Bot" : agent.name,
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
        deliveryPayload: options?.deliveryPayload ?? linkPreviewPayload,
        status: needsWhatsAppDelivery ? "pending" : "sent",
        sortOrder,
        createdAt,
      },
      include: messageCreateInclude(replyTarget?.id),
    });

    const shouldPauseBot =
      senderType === "agent" && !(body.isPrivate ?? false);
    const pauseMinutes =
      conversation.inbox.settings?.botPauseMinutes ?? DEFAULT_BOT_PAUSE_MINUTES;

    const conversationRow = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: createdAt,
        ...(autoAssign ? { assigneeId: agentId } : {}),
        ...(shouldPauseBot
          ? { botPausedUntil: nextBotPausedUntil(createdAt, pauseMinutes) }
          : {}),
      },
      select: conversationMessageEmitSelect,
    });

    broadcastMessageCreated(
      mapMessage(message),
      mapConversationMessageEmit(conversationRow, message, {
        assigneeOverride: autoAssign ? assigneeForEmit : undefined,
      })
    );

    return {
      message,
      scheduleDelivery: needsWhatsAppDelivery,
    };
  });

  if (result.scheduleDelivery) {
    scheduleWhatsAppMessageDelivery(conversationId, result.message.id);
  }

  if (
    !options?.deliveryPayload &&
    (body.contentType ?? "text") === "text" &&
    !body.linkPreview &&
    !body.suppressLinkPreview
  ) {
    scheduleLinkPreviewEnrichment({
      messageId: result.message.id,
      conversationId,
      content: body.content,
      contentType: "text",
    });
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

/** Pide el número con el botón oficial de Meta (REQUEST_CONTACT_INFO). Requiere ventana de 24 h. */
export async function sendRequestContactInfo(
  conversationId: string,
  agentId: string,
  body?: { content?: string; clientMessageId?: string },
  options?: { senderType?: "agent" | "bot" }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { inbox: { select: { channelType: true } } },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");
  if (conversation.inbox.channelType !== "whatsapp") {
    throw new AppError(
      "Pedir el número solo aplica a conversaciones de WhatsApp",
      422,
      "NOT_WHATSAPP"
    );
  }

  return sendAgentMessage(
    conversationId,
    agentId,
    {
      content: normalizeRequestContactInfoBody(body?.content),
      isPrivate: false,
      clientMessageId: body?.clientMessageId,
      suppressLinkPreview: true,
    },
    {
      senderType: options?.senderType,
      deliveryPayload: { kind: "request_contact_info" },
    }
  );
}

/** Envía una plantilla aprobada de WhatsApp vía Meta Cloud API. */
export async function sendWhatsAppTemplate(
  conversationId: string,
  agentId: string,
  body: SendTemplateBody,
  options?: { senderType?: "agent" | "bot" }
) {
  const senderType = options?.senderType ?? "agent";
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      inboxId: true,
      assigneeId: true,
      contact: { select: { isBlocked: true } },
      inbox: {
        select: {
          channelType: true,
          settings: { select: { botPauseMinutes: true } },
        },
      },
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

  const willAutoAssign =
    senderType === "agent" && shouldAutoAssignOnReply(conversation.assigneeId, false);
  const previousAssigneeId = conversation.assigneeId;
  const createdAt = new Date();

  const [agent, template, existingByClientId, assigneeForEmit] = await Promise.all([
    prisma.agent.findUnique({ where: { id: agentId }, select: agentNameSelect }),
    findApprovedTemplate(conversation.inboxId, templateName, language),
    clientMessageId
      ? prisma.message.findFirst({
          where: { conversationId, clientMessageId },
          include: messageInclude,
        })
      : Promise.resolve(null),
    willAutoAssign
      ? prisma.agent.findUnique({
          where: { id: agentId },
          select: conversationMessageEmitSelect.assignee.select,
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

  const autoAssign = willAutoAssign;

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

    const sortOrder = await reserveNextSortOrder(conversationId);

    const message = await prisma.message.create({
      data: {
        conversationId,
        content,
        senderType,
        senderAgentId: agentId,
        senderName: senderType === "bot" ? "Bot" : agent.name,
        isPrivate: false,
        contentType: "text",
        externalId: null,
        clientMessageId,
        deliveryPayload: deliveryPayload as unknown as Prisma.InputJsonValue,
        status: "pending",
        sortOrder,
        createdAt,
      },
      include: messageCreateInclude(),
    });

    const shouldPauseBot = senderType === "agent";
    const pauseMinutes =
      conversation.inbox.settings?.botPauseMinutes ?? DEFAULT_BOT_PAUSE_MINUTES;

    const conversationRow = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: createdAt,
        ...(autoAssign ? { assigneeId: agentId } : {}),
        ...(shouldPauseBot
          ? { botPausedUntil: nextBotPausedUntil(createdAt, pauseMinutes) }
          : {}),
      },
      select: conversationMessageEmitSelect,
    });

    broadcastMessageCreated(
      mapMessage(message),
      mapConversationMessageEmit(conversationRow, message, {
        assigneeOverride: autoAssign ? assigneeForEmit : undefined,
      })
    );

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

  const resolving =
    body.status === "resolved" && conversation.status !== "resolved";

  if (body.status !== undefined) data.status = body.status;
  if (body.assigneeId !== undefined) {
    data.assigneeId = body.assigneeId;
  } else if (resolving && conversation.assigneeId) {
    // Resolver libera al agente para que la próxima apertura arranque sin assignee.
    data.assigneeId = null;
  }
  if (body.unreadCount !== undefined) data.unreadCount = body.unreadCount;

  if (data.assigneeId) {
    const membership = await prisma.inboxAgent.findUnique({
      where: {
        inboxId_agentId: {
          inboxId: conversation.inboxId,
          agentId: data.assigneeId,
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

  // Solo actividad de assignee si el cliente lo pidió explícitamente
  // (la limpieza al resolver no genera mensaje de "desasignada").
  if (body.assigneeId !== undefined) {
    await recordConversationAssigneeActivity({
      conversationId,
      previousAssigneeId: conversation.assigneeId,
      nextAssigneeId: body.assigneeId,
      actorAgentId,
    });
  }

  await emitConversationUpdated(conversationId);

  if (body.status !== undefined && body.status !== conversation.status) {
    await emitConversationStatusChanged(
      conversationId,
      conversation.status,
      body.status
    );
  }

  return mapConversation(updated);
}

export async function findOrReopenConversationForContact(params: {
  inboxId: string;
  contactId: string;
  /** Solo flujos entrantes: asigna del pool si la bandeja lo tiene activo. */
  autoAssign?: boolean;
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
      return { conversation: open, reopened: false as const, created: false as const };
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
      return { conversation, reopened: true as const, created: false as const };
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

    return { conversation, reopened: false as const, created: true as const };
  });

  if (result.reopened) {
    await emitConversationUpdated(result.conversation.id);
    await emitConversationStatusChanged(
      result.conversation.id,
      "resolved",
      "open"
    );
    await recordConversationAutoReopenedActivity(result.conversation.id);
  } else if (result.created) {
    await emitConversationCreated(result.conversation.id);
  }

  let conversation = result.conversation;

  if (
    params.autoAssign &&
    (result.created || result.reopened) &&
    !conversation.assigneeId
  ) {
    const agentId = await pickLeastLoadedAutoAssignAgent(params.inboxId);
    if (agentId) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { assigneeId: agentId },
      });
      await recordConversationAssigneeActivity({
        conversationId: conversation.id,
        previousAssigneeId: null,
        nextAssigneeId: agentId,
        actorAgentId: null,
      });
      await emitConversationUpdated(conversation.id);
    }
  }

  return {
    conversation,
    reopened: result.reopened,
    created: result.created,
  };
}

/** Enciende o apaga el bot en una conversación (Application API / n8n). */
export async function setConversationBotStatus(
  conversationId: string,
  params: { status: "on" | "off"; minutes?: number }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      inbox: { select: { settings: { select: { botPauseMinutes: true } } } },
    },
  });
  if (!conversation) throw new NotFoundError("Conversación no encontrada");

  let botPausedUntil: Date | null = null;

  if (params.status === "off") {
    let minutes =
      conversation.inbox.settings?.botPauseMinutes ?? DEFAULT_BOT_PAUSE_MINUTES;
    if (params.minutes !== undefined) {
      if (
        !Number.isInteger(params.minutes) ||
        params.minutes < BOT_PAUSE_MINUTES_MIN ||
        params.minutes > BOT_PAUSE_MINUTES_MAX
      ) {
        throw new AppError(
          `minutes debe estar entre ${BOT_PAUSE_MINUTES_MIN} y ${BOT_PAUSE_MINUTES_MAX}`,
          400,
          "INVALID_BOT_PAUSE_MINUTES"
        );
      }
      minutes = params.minutes;
    }
    botPausedUntil = nextBotPausedUntil(new Date(), minutes);
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { botPausedUntil },
  });

  await emitConversationUpdated(conversationId);

  return {
    conversationId,
    botStatus: params.status,
    botPausedUntil: botPausedUntil?.toISOString() ?? null,
  };
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
