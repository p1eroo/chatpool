import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { normalizeMarkdownToWhatsApp } from "../../shared/normalize-markdown-to-whatsapp.js";
import { assertAgentCanAccessInbox } from "../inboxes/inbox-access.service.js";
import {
  deleteMediaObject,
  resolvePublicFileUrl,
  uploadCannedMedia,
} from "../media/media-storage.service.js";
import { s3Storage } from "../../infrastructure/storage/s3-storage.service.js";

export type CannedResponseDto = {
  id: string;
  inboxId: string;
  title: string;
  content: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  fileUrl?: string;
  attachmentUrl?: string;
};

type CannedRow = {
  id: string;
  inboxId: string;
  title: string;
  content: string;
  fileKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
};

function mapCannedResponse(row: CannedRow): CannedResponseDto {
  const hasImage = Boolean(row.fileKey);
  return {
    id: row.id,
    inboxId: row.inboxId,
    title: row.title,
    content: row.content,
    fileName: row.fileName ?? undefined,
    mimeType: row.mimeType ?? undefined,
    fileSize: row.fileSize ?? undefined,
    fileUrl: resolvePublicFileUrl(row.fileKey),
    attachmentUrl: hasImage ? `/canned-responses/${row.id}/attachment` : undefined,
  };
}

export async function listCannedResponses(params: { inboxId: string; agentId: string }) {
  await assertAgentCanAccessInbox(params.agentId, params.inboxId);

  const rows = await prisma.cannedResponse.findMany({
    where: { inboxId: params.inboxId },
    orderBy: { title: "asc" },
  });
  return rows.map(mapCannedResponse);
}

export async function createCannedResponse(
  agentId: string,
  input: {
    inboxId: string;
    title: string;
    content: string;
    file?: { buffer: Buffer; originalName: string; mimeType: string };
  }
) {
  await assertAgentCanAccessInbox(agentId, input.inboxId);

  const inbox = await prisma.inbox.findUnique({
    where: { id: input.inboxId },
    select: { id: true },
  });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  const title = input.title.trim();
  const content = normalizeMarkdownToWhatsApp(input.content).trim();
  if (!title) {
    throw new AppError("El título es obligatorio", 400, "INVALID_CANNED_RESPONSE");
  }
  if (!content && !input.file) {
    throw new AppError("Mensaje o imagen son obligatorios", 400, "INVALID_CANNED_RESPONSE");
  }

  let media: Awaited<ReturnType<typeof uploadCannedMedia>> | null = null;
  if (input.file) {
    try {
      media = await uploadCannedMedia({
        inboxId: input.inboxId,
        buffer: input.file.buffer,
        originalName: input.file.originalName,
        mimeType: input.file.mimeType,
      });
    } catch (error) {
      throw new AppError(
        error instanceof Error ? error.message : "No se pudo subir la imagen",
        400,
        "INVALID_CANNED_MEDIA"
      );
    }
  }

  const created = await prisma.cannedResponse.create({
    data: {
      inboxId: input.inboxId,
      title,
      content,
      fileKey: media?.fileKey,
      fileName: media?.fileName,
      mimeType: media?.mimeType,
      fileSize: media?.fileSize,
    },
  });

  return mapCannedResponse(created);
}

export async function updateCannedResponse(
  agentId: string,
  id: string,
  input: {
    title?: string;
    content?: string;
    removeImage?: boolean;
    file?: { buffer: Buffer; originalName: string; mimeType: string };
  }
) {
  const existing = await prisma.cannedResponse.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Respuesta predefinida no encontrada");

  await assertAgentCanAccessInbox(agentId, existing.inboxId);

  const data: {
    title?: string;
    content?: string;
    fileKey?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
  } = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new AppError("El título es obligatorio", 400, "INVALID_CANNED_RESPONSE");
    data.title = title;
  }

  if (input.content !== undefined) {
    data.content = normalizeMarkdownToWhatsApp(input.content).trim();
  }

  const previousKey = existing.fileKey;
  let uploadedKey: string | null = null;

  if (input.file) {
    try {
      const media = await uploadCannedMedia({
        inboxId: existing.inboxId,
        buffer: input.file.buffer,
        originalName: input.file.originalName,
        mimeType: input.file.mimeType,
      });
      data.fileKey = media.fileKey;
      data.fileName = media.fileName;
      data.mimeType = media.mimeType;
      data.fileSize = media.fileSize;
      uploadedKey = media.fileKey;
    } catch (error) {
      throw new AppError(
        error instanceof Error ? error.message : "No se pudo subir la imagen",
        400,
        "INVALID_CANNED_MEDIA"
      );
    }
  } else if (input.removeImage) {
    data.fileKey = null;
    data.fileName = null;
    data.mimeType = null;
    data.fileSize = null;
  }

  const nextContent = data.content !== undefined ? data.content : existing.content;
  const nextHasImage =
    data.fileKey !== undefined ? Boolean(data.fileKey) : Boolean(existing.fileKey);

  if (!nextContent.trim() && !nextHasImage) {
    if (uploadedKey) await deleteMediaObject(uploadedKey);
    throw new AppError("Mensaje o imagen son obligatorios", 400, "INVALID_CANNED_RESPONSE");
  }

  if (Object.keys(data).length === 0) {
    throw new AppError("No hay campos para actualizar", 400, "INVALID_CANNED_RESPONSE");
  }

  const updated = await prisma.cannedResponse.update({
    where: { id },
    data,
  });

  if ((input.file || input.removeImage) && previousKey && previousKey !== updated.fileKey) {
    await deleteMediaObject(previousKey);
  }

  return mapCannedResponse(updated);
}

export async function deleteCannedResponse(agentId: string, id: string) {
  const existing = await prisma.cannedResponse.findUnique({
    where: { id },
    select: { id: true, inboxId: true, fileKey: true },
  });
  if (!existing) throw new NotFoundError("Respuesta predefinida no encontrada");

  await assertAgentCanAccessInbox(agentId, existing.inboxId);
  await prisma.cannedResponse.delete({ where: { id } });
  await deleteMediaObject(existing.fileKey);
}

export async function resolveCannedAttachment(agentId: string, id: string) {
  const existing = await prisma.cannedResponse.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Respuesta predefinida no encontrada");

  await assertAgentCanAccessInbox(agentId, existing.inboxId);

  if (!existing.fileKey) {
    throw new NotFoundError("Esta respuesta no tiene imagen");
  }

  const object = await s3Storage.getObjectBuffer(existing.fileKey);
  return {
    fileName: existing.fileName ?? "imagen.jpg",
    mimeType: existing.mimeType ?? object.contentType,
    fileSize: existing.fileSize ?? object.buffer.length,
    buffer: object.buffer,
  };
}
