import { prisma } from "../../infrastructure/database/prisma.client.js";
import { mapMiniInbox } from "../mappers.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { emitConversationUpdated } from "../realtime/realtime.service.js";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function assertValidColor(color: string) {
  if (!HEX_COLOR_REGEX.test(color)) {
    throw new AppError("Color hex inválido", 400, "INVALID_MINI_INBOX_COLOR");
  }
}

export async function listMiniInboxesForInbox(inboxId: string) {
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: { id: true },
  });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  const rows = await prisma.miniInbox.findMany({
    where: { inboxId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return rows.map(mapMiniInbox);
}

export async function listAllMiniInboxes() {
  const rows = await prisma.miniInbox.findMany({
    orderBy: [{ inboxId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return rows.map(mapMiniInbox);
}

export async function createMiniInboxForInbox(
  inboxId: string,
  input: { name: string; color: string; matchPhrases?: string[]; sortOrder?: number }
) {
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: { id: true },
  });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  const name = input.name.trim();
  if (!name) {
    throw new AppError("El nombre de la bandejita es obligatorio", 400, "INVALID_MINI_INBOX_NAME");
  }

  assertValidColor(input.color);

  const existing = await prisma.miniInbox.findFirst({
    where: { inboxId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "Ya existe una bandejita con ese nombre en esta bandeja",
      400,
      "MINI_INBOX_NAME_EXISTS"
    );
  }

  const sortOrder =
    input.sortOrder ?? (await prisma.miniInbox.count({ where: { inboxId } }));

  const row = await prisma.miniInbox.create({
    data: {
      inboxId,
      name,
      color: input.color.toUpperCase(),
      matchPhrases: input.matchPhrases ?? [],
      sortOrder,
    },
  });

  return mapMiniInbox(row);
}

export async function updateMiniInboxForInbox(
  inboxId: string,
  miniInboxId: string,
  input: { name?: string; color?: string; matchPhrases?: string[] }
) {
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: { id: true },
  });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  const current = await prisma.miniInbox.findFirst({
    where: { id: miniInboxId, inboxId },
  });
  if (!current) throw new NotFoundError("Bandejita no encontrada");

  const name = (input.name ?? current.name).trim();
  if (!name) {
    throw new AppError("El nombre de la bandejita es obligatorio", 400, "INVALID_MINI_INBOX_NAME");
  }

  assertValidColor(input.color ?? current.color);

  const duplicate = await prisma.miniInbox.findFirst({
    where: {
      inboxId,
      name: { equals: name, mode: "insensitive" },
      NOT: { id: miniInboxId },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(
      "Ya existe una bandejita con ese nombre en esta bandeja",
      400,
      "MINI_INBOX_NAME_EXISTS"
    );
  }

  const row = await prisma.miniInbox.update({
    where: { id: miniInboxId },
    data: {
      name,
      color: (input.color ?? current.color).toUpperCase(),
      matchPhrases: input.matchPhrases ?? current.matchPhrases,
    },
  });

  return mapMiniInbox(row);
}

export async function deleteMiniInboxForInbox(inboxId: string, miniInboxId: string) {
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: { id: true },
  });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  const row = await prisma.miniInbox.findFirst({
    where: { id: miniInboxId, inboxId },
    select: { id: true },
  });
  if (!row) throw new NotFoundError("Bandejita no encontrada");

  // Las conversaciones vuelven a la bandeja principal (mini_inbox_id → null).
  const affectedConversationIds = (
    await prisma.conversation.findMany({
      where: { miniInboxId },
      select: { id: true },
    })
  ).map((item) => item.id);

  try {
    await prisma.miniInbox.delete({ where: { id: miniInboxId } });
  } catch {
    throw new AppError("No se pudo eliminar la bandejita", 500, "MINI_INBOX_DELETE_FAILED");
  }

  for (const conversationId of affectedConversationIds) {
    await emitConversationUpdated(conversationId);
  }

  return { id: miniInboxId };
}
