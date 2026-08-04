import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { mapContact } from "../mappers.js";

export async function listContacts(filters: { inboxId?: string }) {
  const where: Record<string, unknown> = {};

  if (filters.inboxId) {
    where.inboxId = filters.inboxId;
  }

  const rows = await prisma.contact.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return rows.map(mapContact);
}

export async function getContactById(contactId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new NotFoundError("Contacto no encontrado");
  return mapContact(contact);
}

export async function updateContact(
  contactId: string,
  input: {
    name?: string;
    phone?: string | null;
    email?: string;
    isBlocked?: boolean;
  }
) {
  const existing = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!existing) throw new NotFoundError("Contacto no encontrado");

  const data: {
    name?: string;
    phone?: string | null;
    email?: string;
    isBlocked?: boolean;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AppError("El nombre es obligatorio", 400, "INVALID_CONTACT");
    data.name = name;
  }

  if (input.phone !== undefined) {
    const phone = input.phone?.trim() || null;
    data.phone = phone;
  }

  if (input.email !== undefined) {
    data.email = input.email.trim();
  }

  if (input.isBlocked !== undefined) {
    data.isBlocked = input.isBlocked;
  }

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data,
  });

  return mapContact(updated);
}

/** Elimina el contacto y, en cascada, sus conversaciones y mensajes. */
export async function deleteContact(contactId: string) {
  const existing = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Contacto no encontrado");

  const conversationIds = (
    await prisma.conversation.findMany({
      where: { contactId },
      select: { id: true },
    })
  ).map((row) => row.id);

  await prisma.contact.delete({ where: { id: contactId } });

  return { conversationIds };
}
