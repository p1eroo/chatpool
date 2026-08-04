import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { normalizeMarkdownToWhatsApp } from "../../shared/normalize-markdown-to-whatsapp.js";
import { assertAgentCanAccessInbox } from "../inboxes/inbox-access.service.js";

export async function listCannedResponses(params: { inboxId: string; agentId: string }) {
  await assertAgentCanAccessInbox(params.agentId, params.inboxId);

  return prisma.cannedResponse.findMany({
    where: { inboxId: params.inboxId },
    orderBy: { title: "asc" },
  });
}

export async function createCannedResponse(
  agentId: string,
  input: { inboxId: string; title: string; content: string }
) {
  await assertAgentCanAccessInbox(agentId, input.inboxId);

  const inbox = await prisma.inbox.findUnique({
    where: { id: input.inboxId },
    select: { id: true },
  });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  const title = input.title.trim();
  const content = normalizeMarkdownToWhatsApp(input.content).trim();
  if (!title || !content) {
    throw new AppError("Título y mensaje son obligatorios", 400, "INVALID_CANNED_RESPONSE");
  }

  return prisma.cannedResponse.create({
    data: {
      inboxId: input.inboxId,
      title,
      content,
    },
  });
}

export async function updateCannedResponse(
  agentId: string,
  id: string,
  input: { title?: string; content?: string }
) {
  const existing = await prisma.cannedResponse.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Respuesta predefinida no encontrada");

  await assertAgentCanAccessInbox(agentId, existing.inboxId);

  const data: { title?: string; content?: string } = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new AppError("El título es obligatorio", 400, "INVALID_CANNED_RESPONSE");
    data.title = title;
  }

  if (input.content !== undefined) {
    const content = normalizeMarkdownToWhatsApp(input.content).trim();
    if (!content) throw new AppError("El mensaje es obligatorio", 400, "INVALID_CANNED_RESPONSE");
    data.content = content;
  }

  if (Object.keys(data).length === 0) {
    throw new AppError("No hay campos para actualizar", 400, "INVALID_CANNED_RESPONSE");
  }

  return prisma.cannedResponse.update({
    where: { id },
    data,
  });
}

export async function deleteCannedResponse(agentId: string, id: string) {
  const existing = await prisma.cannedResponse.findUnique({
    where: { id },
    select: { id: true, inboxId: true },
  });
  if (!existing) throw new NotFoundError("Respuesta predefinida no encontrada");

  await assertAgentCanAccessInbox(agentId, existing.inboxId);
  await prisma.cannedResponse.delete({ where: { id } });
}
