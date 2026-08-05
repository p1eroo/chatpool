import type { MessageContentType } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import {
  metaApiClient,
  type WhatsAppTemplateSendComponent,
} from "../../infrastructure/meta/meta-api.client.js";
import { AppError } from "../../domain/errors.js";
import { resolveMetaSendFailure } from "../../shared/meta-api-errors.js";
import { resolveWhatsAppOutboundTarget } from "../../shared/whatsapp-contact.js";
import { shouldEnableWhatsAppLinkPreview } from "../link-preview/link-preview.service.js";

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

function resolveRecipientOrThrow(
  recipientWaId: string | null | undefined,
  recipientPhone: string | null | undefined
) {
  try {
    return resolveWhatsAppOutboundTarget({
      waId: recipientWaId,
      phone: recipientPhone,
    });
  } catch {
    throw new AppError(
      "Este contacto no tiene teléfono ni ID de WhatsApp válido para responder. Pide que escriba de nuevo o comparta su número.",
      422,
      "WHATSAPP_NO_RECIPIENT"
    );
  }
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
  enableLinkPreview?: boolean;
}): Promise<{ externalId: string; mediaExternalId?: string }> {
  const { phoneNumberId, accessToken } = await resolveInboxWhatsAppCredentials(params.inboxId);
  const target = resolveRecipientOrThrow(params.recipientWaId, params.recipientPhone);
  const context = buildReplyContext(params.replyToExternalId);
  const addressing =
    target.kind === "phone"
      ? { to: target.to }
      : { recipient: target.recipient };

  try {
    if (params.contentType === "text") {
      const externalId = await metaApiClient.sendWhatsAppMessage(phoneNumberId, accessToken, {
        ...addressing,
        context,
        type: "text",
        text: {
          body: params.content,
          preview_url:
            params.enableLinkPreview !== false &&
            shouldEnableWhatsAppLinkPreview(params.content),
        },
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
        ...addressing,
        context,
        type: "image",
        image: { id: mediaExternalId, caption: captionOrUndefined },
      });
      return { externalId, mediaExternalId };
    }

    if (params.contentType === "sticker") {
      const externalId = await metaApiClient.sendWhatsAppMessage(phoneNumberId, accessToken, {
        ...addressing,
        context,
        type: "sticker",
        sticker: { id: mediaExternalId },
      });
      return { externalId, mediaExternalId };
    }

    if (params.contentType === "audio") {
      const externalId = await metaApiClient.sendWhatsAppMessage(phoneNumberId, accessToken, {
        ...addressing,
        context,
        type: "audio",
        audio: { id: mediaExternalId },
      });
      return { externalId, mediaExternalId };
    }

    const externalId = await metaApiClient.sendWhatsAppMessage(phoneNumberId, accessToken, {
      ...addressing,
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

export async function deliverWhatsAppTemplate(params: {
  inboxId: string;
  recipientWaId: string | null;
  recipientPhone: string | null;
  name: string;
  language: string;
  components?: WhatsAppTemplateSendComponent[];
}): Promise<{ externalId: string }> {
  const { phoneNumberId, accessToken } = await resolveInboxWhatsAppCredentials(params.inboxId);
  const target = resolveRecipientOrThrow(params.recipientWaId, params.recipientPhone);
  const addressing =
    target.kind === "phone"
      ? { to: target.to }
      : { recipient: target.recipient };

  try {
    const externalId = await metaApiClient.sendWhatsAppMessage(phoneNumberId, accessToken, {
      ...addressing,
      type: "template",
      template: {
        name: params.name,
        language: { code: params.language },
        components: params.components?.length ? params.components : undefined,
      },
    });
    return { externalId };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const failure = resolveMetaSendFailure(error);
    throw new AppError(failure.message, 502, failure.code);
  }
}
