import { randomUUID } from "node:crypto";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import {
  copyConversationMediaFromKey,
  resolvePublicFileUrl,
} from "../media/media-storage.service.js";
import { resolveMessageAttachment } from "../media/message-attachment.service.js";
import { s3Storage } from "../../infrastructure/storage/s3-storage.service.js";
import { assertAgentCanAccessConversation } from "../inboxes/inbox-access.service.js";
import { sendAgentMessage } from "../conversations/conversations.service.js";

export type SavedStickerDto = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl?: string;
  createdAt: string;
};

function mapSavedSticker(row: {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileKey: string;
  createdAt: Date;
}): SavedStickerDto {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    fileUrl: resolvePublicFileUrl(row.fileKey),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSavedStickers(agentId: string) {
  const rows = await prisma.savedSticker.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(mapSavedSticker);
}

export async function saveStickerFromMessage(params: {
  agentId: string;
  conversationId: string;
  messageId: string;
}) {
  await assertAgentCanAccessConversation(params.agentId, params.conversationId);

  const message = await prisma.message.findFirst({
    where: { id: params.messageId, conversationId: params.conversationId },
    select: {
      id: true,
      contentType: true,
      fileKey: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
    },
  });

  if (!message) throw new NotFoundError("Mensaje no encontrado");
  if (message.contentType !== "sticker") {
    throw new AppError("Solo puedes guardar mensajes de tipo sticker", 422, "NOT_STICKER");
  }

  const existing = await prisma.savedSticker.findUnique({
    where: {
      agentId_sourceMessageId: {
        agentId: params.agentId,
        sourceMessageId: message.id,
      },
    },
  });
  if (existing) return mapSavedSticker(existing);

  const attachment = await resolveMessageAttachment(params.conversationId, params.messageId);
  const mimeType = attachment.mimeType || message.mimeType || "image/webp";
  const fileName = message.fileName || attachment.fileName || "sticker.webp";
  const fileKey = `agents/${params.agentId}/stickers/${randomUUID()}-${fileName}`;

  await s3Storage.putObject(fileKey, attachment.buffer, mimeType);

  const created = await prisma.savedSticker.create({
    data: {
      agentId: params.agentId,
      fileKey,
      fileName,
      mimeType,
      fileSize: attachment.buffer.length,
      sourceMessageId: message.id,
    },
  });

  return mapSavedSticker(created);
}

export async function deleteSavedSticker(agentId: string, stickerId: string) {
  const existing = await prisma.savedSticker.findFirst({
    where: { id: stickerId, agentId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Sticker no encontrado");

  await prisma.savedSticker.delete({ where: { id: stickerId } });
}

export async function sendSavedSticker(params: {
  agentId: string;
  conversationId: string;
  stickerId: string;
  replyToMessageId?: string;
  clientMessageId?: string;
}) {
  await assertAgentCanAccessConversation(params.agentId, params.conversationId);

  const sticker = await prisma.savedSticker.findFirst({
    where: { id: params.stickerId, agentId: params.agentId },
  });
  if (!sticker) throw new NotFoundError("Sticker no encontrado");

  const copied = await copyConversationMediaFromKey({
    conversationId: params.conversationId,
    sourceKey: sticker.fileKey,
    originalName: sticker.fileName,
    mimeType: sticker.mimeType || "image/webp",
    fileSize: sticker.fileSize,
  });

  return sendAgentMessage(params.conversationId, params.agentId, {
    content: "Sticker",
    contentType: "sticker",
    fileName: copied.fileName,
    fileSize: copied.fileSize,
    fileKey: copied.fileKey,
    mimeType: copied.mimeType,
    replyToMessageId: params.replyToMessageId,
    clientMessageId: params.clientMessageId,
  });
}
