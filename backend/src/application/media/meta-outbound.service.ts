import type { MessageContentType } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { metaApiClient } from "../../infrastructure/meta/meta-api.client.js";
import { AppError } from "../../domain/errors.js";
import { resolveMetaSendFailure } from "../../shared/meta-api-errors.js";

function normalizeWhatsAppRecipient(
  waId: string | null | undefined,
  phone: string | null | undefined
): string {
  const raw = (waId || phone || "").replace(/\D/g, "");
  if (!raw) {
    throw new AppError(
      "El contacto no tiene número de WhatsApp válido",
      422,
      "WHATSAPP_NO_RECIPIENT"
    );
  }
  return raw;
}

async function resolveInboxWhatsAppCredentials(inboxId: string) {
  const settings = await prisma.inboxSettings.findUnique({
    where: { inboxId },
  });

  const phoneNumberId = settings?.phoneNumberId?.trim();
  const accessToken = settings?.accessToken?.trim();

  if (!phoneNumberId || !accessToken) {
    throw new AppError(
      "La bandeja no tiene phone_number_id o token de Meta configurados",
      422,
      "META_NOT_CONFIGURED"
    );
  }

  return { phoneNumberId, accessToken };
}

function buildReplyContext(replyToExternalId?: string | null) {
  const messageId = replyToExternalId?.trim();
  if (!messageId) return undefined;
  return { message_id: messageId };
}

export async function deliverWhatsAppOutbound(params: {
  inboxId: string;
  recipientWaId: string | null;
  recipientPhone: string | null;
  contentType: MessageContentType;
  content: string;
  fileName?: string | null;
  mimeType?: string | null;
  mediaBuffer?: Buffer;
  replyToExternalId?: string | null;
}): Promise<{ externalId: string; mediaExternalId?: string }> {
  const { phoneNumberId, accessToken } = await resolveInboxWhatsAppCredentials(params.inboxId);
  const to = normalizeWhatsAppRecipient(params.recipientWaId, params.recipientPhone);
  const context = buildReplyContext(params.replyToExternalId);

  try {
    if (params.contentType === "text") {
      const externalId = await metaApiClient.sendWhatsAppMessage(phoneNumberId, accessToken, {
        to,
        context,
        type: "text",
        text: { body: params.content, preview_url: false },
      });
      return { externalId };
    }

    if (!params.mediaBuffer?.length) {
      throw new AppError("Falta el archivo para enviar por WhatsApp", 422, "WHATSAPP_MEDIA_REQUIRED");
    }

    const mimeType = params.mimeType?.trim() || "application/octet-stream";
    const fileName = params.fileName?.trim() || "archivo";
    const mediaExternalId = await metaApiClient.uploadWhatsAppMedia(phoneNumberId, accessToken, {
      buffer: params.mediaBuffer,
      mimeType,
      filename: fileName,
    });

    const caption = params.content.trim();
    const captionOrUndefined = caption && caption !== fileName ? caption : undefined;

    if (params.contentType === "image") {
      const externalId = await metaApiClient.sendWhatsAppMessage(phoneNumberId, accessToken, {
        to,
        context,
        type: "image",
        image: { id: mediaExternalId, caption: captionOrUndefined },
      });
      return { externalId, mediaExternalId };
    }

    if (params.contentType === "audio") {
      const externalId = await metaApiClient.sendWhatsAppMessage(phoneNumberId, accessToken, {
        to,
        context,
        type: "audio",
        audio: { id: mediaExternalId },
      });
      return { externalId, mediaExternalId };
    }

    const externalId = await metaApiClient.sendWhatsAppMessage(phoneNumberId, accessToken, {
      to,
      context,
      type: "document",
      document: {
        id: mediaExternalId,
        filename: fileName,
        caption: captionOrUndefined,
      },
    });
    return { externalId, mediaExternalId };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const failure = resolveMetaSendFailure(error);
    throw new AppError(failure.message, 502, failure.code);
  }
}
