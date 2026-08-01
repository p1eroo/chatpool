import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { s3Storage } from "../../infrastructure/storage/s3-storage.service.js";

const MAX_BYTES =
  Math.min(500, Math.max(1, env.FILES_MAX_MB)) * 1024 * 1024;

function safeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._\-ñÑ áéíóúÁÉÍÓÚ]+/g, "_").trim();
  return (base || "archivo").slice(0, 200);
}

export function assertMediaStorageReady(): void {
  if (!s3Storage.isConfigured()) {
    throw new Error(
      "Almacenamiento no configurado: define S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY y S3_BUCKET."
    );
  }
}

export function buildConversationMediaKey(
  conversationId: string,
  originalName: string
): string {
  return `conversations/${conversationId}/${randomUUID()}-${safeFilename(originalName)}`;
}

export async function uploadConversationMedia(params: {
  conversationId: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}): Promise<{ fileKey: string; fileUrl: string; fileName: string; fileSize: number; mimeType: string }> {
  assertMediaStorageReady();

  if (params.buffer.length === 0) {
    throw new Error("Archivo vacío");
  }

  if (params.buffer.length > MAX_BYTES) {
    throw new Error(
      `El archivo supera el máximo permitido (${Math.floor(MAX_BYTES / (1024 * 1024))} MB)`
    );
  }

  const fileName = safeFilename(params.originalName);
  const fileKey = buildConversationMediaKey(params.conversationId, fileName);
  const mimeType = params.mimeType.trim() || "application/octet-stream";

  await s3Storage.putObject(fileKey, params.buffer, mimeType);

  return {
    fileKey,
    fileUrl: s3Storage.getPublicUrl(fileKey),
    fileName,
    fileSize: params.buffer.length,
    mimeType,
  };
}

export function resolvePublicFileUrl(fileKey: string | null | undefined): string | undefined {
  if (!fileKey || !s3Storage.isConfigured()) return undefined;
  return s3Storage.getPublicUrl(fileKey);
}
