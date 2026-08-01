import { prisma } from "../../infrastructure/database/prisma.client.js";
import { NotFoundError, AppError } from "../../domain/errors.js";
import { downloadAndStoreMetaMedia } from "./meta-media.service.js";
import { s3Storage } from "../../infrastructure/storage/s3-storage.service.js";
import { resolveMetaApiFailure } from "../../shared/meta-api-errors.js";

interface ResolvedAttachment {
  fileName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}

export async function resolveMessageAttachment(
  conversationId: string,
  messageId: string
): Promise<ResolvedAttachment> {
  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId },
    include: {
      conversation: {
        include: {
          inbox: {
            include: { settings: true },
          },
        },
      },
    },
  });

  if (!message) {
    throw new NotFoundError("Mensaje no encontrado");
  }

  if (message.contentType === "text" && !message.fileKey) {
    throw new NotFoundError("Este mensaje no tiene adjunto");
  }

  if (message.fileKey) {
    const object = await s3Storage.getObjectBuffer(message.fileKey);
    return {
      fileName: message.fileName ?? "archivo",
      mimeType: message.mimeType ?? object.contentType,
      fileSize: message.fileSize ?? object.buffer.length,
      buffer: object.buffer,
    };
  }

  const accessToken = message.conversation.inbox.settings?.accessToken?.trim();
  if (!message.mediaExternalId || !accessToken) {
    throw new NotFoundError(
      "El archivo no está disponible. Pide al contacto que lo reenvíe."
    );
  }

  try {
    const stored = await downloadAndStoreMetaMedia({
      conversationId,
      accessToken,
      mediaId: message.mediaExternalId,
      fileName: message.fileName ?? "archivo",
      mimeType: message.mimeType ?? "application/octet-stream",
    });

    await prisma.message.update({
      where: { id: messageId },
      data: {
        fileKey: stored.fileKey,
        fileSize: stored.fileSize,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
      },
    });

    const object = await s3Storage.getObjectBuffer(stored.fileKey);
    return {
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      buffer: object.buffer,
    };
  } catch (error) {
    const failure = resolveMetaApiFailure(error);
    throw new AppError(failure.message, 502, failure.code);
  }
}

function buildContentDisposition(fileName: string, disposition: "inline" | "attachment"): string {
  const ascii = fileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, "_")
    .slice(0, 200);
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${ascii || "archivo"}"; filename*=UTF-8''${encoded}`;
}

export function attachmentResponseHeaders(
  fileName: string,
  mimeType: string,
  disposition: "inline" | "attachment"
): Record<string, string> {
  return {
    "Content-Type": mimeType,
    "Content-Disposition": buildContentDisposition(fileName, disposition),
    "Cache-Control": "private, max-age=3600",
  };
}
