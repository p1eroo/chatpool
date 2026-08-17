import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { mapContact } from "../mappers.js";
import {
  assertAgentCanAccessInbox,
  listInboxIdsForAgent,
} from "../inboxes/inbox-access.service.js";
import { normalizeWhatsAppWaId } from "../../shared/whatsapp-contact.js";

/** Dígitos E.164 para lookup (9xxxxxxxx PE → 51…). No lanza si el valor es inválido. */
export function normalizeContactLookupPhone(raw: string): string {
  let digits = normalizeWhatsAppWaId(raw);
  if (digits.length === 9 && digits.startsWith("9")) {
    digits = `51${digits}`;
  }
  return digits;
}

export type InboxContactConversation = {
  id: string;
  name: string;
  phone: string | null;
  conversationId: string | null;
  conversation_id: string | null;
};

/**
 * Contactos de una bandeja con el conversation id para Application API / n8n.
 * Prefiere la conversación `open`; si no hay, la más reciente.
 */
export async function listInboxContactsWithConversation(params: {
  inboxId: string;
  phone?: string;
}): Promise<InboxContactConversation[]> {
  const phone = params.phone?.trim()
    ? normalizeContactLookupPhone(params.phone)
    : undefined;

  const rows = await prisma.contact.findMany({
    where: {
      inboxId: params.inboxId,
      ...(phone
        ? {
            OR: [{ phone }, { waId: phone }],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      conversations: {
        select: { id: true, status: true },
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  return rows.map((row) => {
    const open = row.conversations.find((item) => item.status === "open");
    const conversationId = open?.id ?? row.conversations[0]?.id ?? null;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      conversationId,
      conversation_id: conversationId,
    };
  });
}

export async function listContacts(filters: { inboxId?: string; agentId?: string }) {
  const where: Record<string, unknown> = {};

  if (filters.agentId) {
    if (filters.inboxId) {
      await assertAgentCanAccessInbox(filters.agentId, filters.inboxId);
      where.inboxId = filters.inboxId;
    } else {
      const accessibleInboxIds = await listInboxIdsForAgent(filters.agentId);
      if (accessibleInboxIds.length === 0) return [];
      where.inboxId = { in: accessibleInboxIds };
    }
  } else if (filters.inboxId) {
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
    city?: string | null;
    company?: string | null;
    isBlocked?: boolean;
  }
) {
  const existing = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!existing) throw new NotFoundError("Contacto no encontrado");

  const data: {
    name?: string;
    phone?: string | null;
    email?: string;
    city?: string | null;
    company?: string | null;
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

  if (input.city !== undefined) {
    data.city = input.city?.trim() || null;
  }

  if (input.company !== undefined) {
    data.company = input.company?.trim() || null;
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
