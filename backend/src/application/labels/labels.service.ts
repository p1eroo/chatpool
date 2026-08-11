import { prisma } from "../../infrastructure/database/prisma.client.js";
import { mapLabel } from "../mappers.js";
import { AppError, NotFoundError } from "../../domain/errors.js";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export async function listLabelsForInbox(inboxId: string) {
  const inbox = await prisma.inbox.findUnique({ where: { id: inboxId }, select: { id: true } });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  const labels = await prisma.label.findMany({
    where: { inboxId },
    orderBy: { name: "asc" },
  });

  return labels.map(mapLabel);
}

export async function listAllLabels() {
  const labels = await prisma.label.findMany({
    orderBy: [{ inboxId: "asc" }, { name: "asc" }],
  });

  return labels.map(mapLabel);
}

export async function createLabelForInbox(
  inboxId: string,
  input: { name: string; color: string }
) {
  const inbox = await prisma.inbox.findUnique({ where: { id: inboxId }, select: { id: true } });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  const name = input.name.trim().toLowerCase();
  if (!name) {
    throw new Error("El nombre de la etiqueta es obligatorio");
  }

  if (!HEX_COLOR_REGEX.test(input.color)) {
    throw new Error("Color hex inválido");
  }

  const existing = await prisma.label.findUnique({
    where: { inboxId_name: { inboxId, name } },
  });
  if (existing) {
    throw new Error("Ya existe una etiqueta con ese nombre en esta bandeja");
  }

  const label = await prisma.label.create({
    data: {
      inboxId,
      name,
      color: input.color.toUpperCase(),
    },
  });

  return mapLabel(label);
}

export async function deleteLabelForInbox(inboxId: string, labelId: string) {
  const inbox = await prisma.inbox.findUnique({ where: { id: inboxId }, select: { id: true } });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  const label = await prisma.label.findFirst({
    where: { id: labelId, inboxId },
    select: { id: true },
  });
  if (!label) throw new NotFoundError("Etiqueta no encontrada");

  try {
    await prisma.label.delete({ where: { id: labelId } });
  } catch {
    throw new AppError("No se pudo eliminar la etiqueta", 500, "LABEL_DELETE_FAILED");
  }

  return { id: labelId };
}
