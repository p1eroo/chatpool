import type { MessageContentType, Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { s3Storage } from "../../infrastructure/storage/s3-storage.service.js";
import {
  deliverWhatsAppOutbound,
  deliverWhatsAppRequestContactInfo,
  deliverWhatsAppTemplate,
} from "../media/meta-outbound.service.js";
import { emitMessageUpdated } from "../realtime/realtime.service.js";
import { isLinkPreviewSuppressed } from "../../shared/link-preview.js";
import { mapMessage, messageInclude } from "../mappers.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { resolveMetaSendFailure } from "../../shared/meta-api-errors.js";
import { logDeliveryTiming } from "../../shared/send-timing.js";
import type { WhatsAppTemplateSendComponent } from "../../infrastructure/meta/meta-api.client.js";
import { assertAgentCanAccessConversation } from "../inboxes/inbox-access.service.js";

const deliveryTails = new Map<string, Promise<void>>();

interface TemplateDeliveryPayload {
  kind: "template";
  name: string;
  language: string;
  components?: WhatsAppTemplateSendComponent[];
}

function parseTemplateDeliveryPayload(
  value: Prisma.JsonValue | null | undefined
): TemplateDeliveryPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "template") return null;
  if (typeof record.name !== "string" || typeof record.language !== "string") return null;

  return {
    kind: "template",
    name: record.name,
    language: record.language,
    components: Array.isArray(record.components)
      ? (record.components as WhatsAppTemplateSendComponent[])
      : undefined,
  };
}

function resolveTemplateDeliveryMeta(message: {
  id: string;
  deliveryPayload: Prisma.JsonValue | null;
}): TemplateDeliveryPayload | null {
  return parseTemplateDeliveryPayload(message.deliveryPayload);
}

function isRequestContactInfoDeliveryPayload(
  value: Prisma.JsonValue | null | undefined
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).kind === "request_contact_info";
}

/** Encola entrega a Meta por conversación (orden FIFO, sin bloquear el HTTP). */
export function scheduleWhatsAppMessageDelivery(
  conversationId: string,
  messageId: string
): void {
  const previous = deliveryTails.get(conversationId) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(() => deliverPendingWhatsAppMessage(messageId));

  deliveryTails.set(conversationId, run);
  void run.catch((error) => {
    console.error(`[delivery] message ${messageId} failed:`, error);
  });
}

async function loadMediaBuffer(
  contentType: MessageContentType,
  fileKey: string | null
): Promise<Buffer | undefined> {
  if (contentType === "text" || !fileKey) return undefined;
  const object = await s3Storage.getObjectBuffer(fileKey);
  return object.buffer;
}

async function deliverPendingWhatsAppMessage(messageId: string): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      ...messageInclude,
      conversation: {
        include: {
          inbox: true,
          contact: true,
        },
      },
    },
  });

  if (!message || message.status !== "pending" || message.isPrivate) return;
  if (message.conversation.inbox.channelType !== "whatsapp") return;

  const { conversation } = message;
  const deliveryStarted = performance.now();
  logDeliveryTiming("start", { conversationId: conversation.id, messageId });

  try {
    let externalId: string;
    let mediaExternalId: string | null = null;

    const templateMeta = resolveTemplateDeliveryMeta(message);
    if (isRequestContactInfoDeliveryPayload(message.deliveryPayload)) {
      const delivered = await deliverWhatsAppRequestContactInfo({
        inboxId: conversation.inboxId,
        recipientWaId: conversation.contact.waId,
        recipientPhone: conversation.contact.phone,
        bodyText: message.content,
      });
      externalId = delivered.externalId;
    } else if (templateMeta) {
      const delivered = await deliverWhatsAppTemplate({
        inboxId: conversation.inboxId,
        recipientWaId: conversation.contact.waId,
        recipientPhone: conversation.contact.phone,
        name: templateMeta.name,
        language: templateMeta.language,
        components: templateMeta.components,
      });
      externalId = delivered.externalId;
    } else {
      const replyTarget = message.replyToMessageId
        ? await prisma.message.findUnique({
            where: { id: message.replyToMessageId },
            select: { externalId: true },
          })
        : null;

      const mediaBuffer = await loadMediaBuffer(message.contentType, message.fileKey);

      const delivered = await deliverWhatsAppOutbound({
        inboxId: conversation.inboxId,
        recipientWaId: conversation.contact.waId,
        recipientPhone: conversation.contact.phone,
        contentType: message.contentType,
        content: message.content,
        fileName: message.fileName,
        mimeType: message.mimeType,
        mediaBuffer,
        replyToExternalId: replyTarget?.externalId,
        enableLinkPreview: !isLinkPreviewSuppressed(message.deliveryPayload),
      });
      externalId = delivered.externalId;
      mediaExternalId = delivered.mediaExternalId ?? null;
    }

    logDeliveryTiming("meta-ok", {
      conversationId: conversation.id,
      messageId,
      ms: performance.now() - deliveryStarted,
    });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        externalId,
        mediaExternalId,
        status: "sent",
        errorMessage: null,
      },
      include: messageInclude,
    });

    await emitMessageUpdated(conversation.id, messageId, updated);
    logDeliveryTiming("done", {
      conversationId: conversation.id,
      messageId,
      ms: performance.now() - deliveryStarted,
    });
  } catch (error) {
    const failure = resolveMetaSendFailure(error);
    console.error(`[delivery] marking message ${messageId} as failed:`, failure.message, error);
    logDeliveryTiming("meta-failed", {
      conversationId: conversation.id,
      messageId,
      ms: performance.now() - deliveryStarted,
    });
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { status: "failed", errorMessage: failure.message },
      include: messageInclude,
    });
    await emitMessageUpdated(conversation.id, messageId, updated);
  }
}

/** Reintenta la entrega de un mensaje fallido (mismo registro, sin duplicar). */
export async function retryFailedMessageDelivery(params: {
  conversationId: string;
  messageId: string;
  agentId: string;
}) {
  await assertAgentCanAccessConversation(params.agentId, params.conversationId);

  const message = await prisma.message.findFirst({
    where: {
      id: params.messageId,
      conversationId: params.conversationId,
      senderType: "agent",
      status: "failed",
      isPrivate: false,
    },
    include: {
      ...messageInclude,
      conversation: { include: { inbox: true } },
    },
  });

  if (!message) {
    throw new NotFoundError("Mensaje fallido no encontrado para reintentar");
  }

  if (message.conversation.inbox.channelType !== "whatsapp") {
    throw new AppError("Solo se pueden reintentar mensajes de WhatsApp", 422);
  }

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: {
      status: "pending",
      errorMessage: null,
      externalId: null,
      mediaExternalId: message.contentType === "text" ? null : message.mediaExternalId,
    },
    include: messageInclude,
  });

  scheduleWhatsAppMessageDelivery(params.conversationId, message.id);
  await emitMessageUpdated(params.conversationId, message.id, updated);

  return mapMessage(updated);
}

/** Reintenta mensajes pending tras reinicio (best-effort). */
export function resumePendingWhatsAppDeliveries(): void {
  void (async () => {
    const pending = await prisma.message.findMany({
      where: {
        status: "pending",
        isPrivate: false,
        conversation: { inbox: { channelType: "whatsapp" } },
      },
      select: { id: true, conversationId: true },
      orderBy: [{ conversationId: "asc" }, { sortOrder: "asc" }],
      take: 200,
    });

    for (const row of pending) {
      scheduleWhatsAppMessageDelivery(row.conversationId, row.id);
    }
  })().catch((error) => {
    console.error("[delivery] resume pending failed:", error);
  });
}

export function buildTemplateDeliveryPayload(params: {
  name: string;
  language: string;
  components?: WhatsAppTemplateSendComponent[];
}): TemplateDeliveryPayload {
  return {
    kind: "template",
    name: params.name,
    language: params.language,
    components: params.components,
  };
}
