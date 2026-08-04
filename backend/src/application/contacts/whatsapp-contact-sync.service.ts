import { prisma } from "../../infrastructure/database/prisma.client.js";
import {
  contactAvatarInitials,
  normalizeWhatsAppWaId,
  resolveIncomingContactName,
  resolveWhatsAppContactName,
  sanitizeWhatsAppDisplayName,
} from "../../shared/whatsapp-contact.js";

export interface SmbContactSyncEntry {
  type?: string;
  action?: string;
  contact?: {
    full_name?: string;
    first_name?: string;
    phone_number?: string;
  };
}

export async function upsertWhatsAppContact(
  inboxId: string,
  params: {
    waId: string;
    name: string;
    touchLastSeen?: boolean;
    /** Sync desde WhatsApp Business App: puede actualizar el nombre guardado. */
    overwriteName?: boolean;
  }
) {
  const waId = normalizeWhatsAppWaId(params.waId);
  if (!waId) return null;

  const incomingName = sanitizeWhatsAppDisplayName(params.name, waId);

  const existing = await prisma.contact.findUnique({
    where: {
      inboxId_waId: {
        inboxId,
        waId,
      },
    },
  });

  if (existing) {
    const name = resolveIncomingContactName(existing.name, incomingName, waId, {
      allowOverwrite: params.overwriteName ?? false,
    });

    try {
      return await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name,
          phone: waId,
          ...(params.touchLastSeen ? { lastSeen: new Date() } : {}),
        },
      });
    } catch (error) {
      console.error("No se pudo actualizar contacto WhatsApp:", {
        waId,
        name,
        error: error instanceof Error ? error.message : error,
      });
      // Mejor devolver el existente que tumbar el webhook y perder el mensaje.
      return existing;
    }
  }

  const name = incomingName;
  const avatar = contactAvatarInitials(name);

  try {
    return await prisma.contact.create({
      data: {
        inboxId,
        name,
        phone: waId,
        waId,
        avatar,
      },
    });
  } catch (error) {
    console.error("No se pudo crear contacto WhatsApp, reintento con waId:", {
      waId,
      name,
      avatar,
      error: error instanceof Error ? error.message : error,
    });
  }

  // Fallback: nombre = número (siempre ASCII seguro).
  try {
    return await prisma.contact.create({
      data: {
        inboxId,
        name: waId,
        phone: waId,
        waId,
        avatar: contactAvatarInitials(waId),
      },
    });
  } catch (error) {
    // Carrera: otro webhook lo creó entre medias.
    const raced = await prisma.contact.findUnique({
      where: { inboxId_waId: { inboxId, waId } },
    });
    if (raced) return raced;

    console.error("Fallo definitivo creando contacto WhatsApp:", {
      waId,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

async function removeSyncedContact(inboxId: string, phoneNumber: string) {
  const waId = normalizeWhatsAppWaId(phoneNumber);
  if (!waId) return;

  const contact = await prisma.contact.findUnique({
    where: {
      inboxId_waId: {
        inboxId,
        waId,
      },
    },
    include: {
      _count: {
        select: { conversations: true },
      },
    },
  });

  if (!contact) return;

  if (contact._count.conversations === 0) {
    await prisma.contact.delete({ where: { id: contact.id } });
  }
}

export async function processSmbAppStateSync(
  inboxId: string,
  entries: SmbContactSyncEntry[]
): Promise<number> {
  let processed = 0;

  for (const entry of entries) {
    if (entry.type !== "contact") continue;

    const phoneNumber = entry.contact?.phone_number;
    if (!phoneNumber) continue;

    const action = entry.action?.toLowerCase() ?? "add";

    if (action === "remove") {
      await removeSyncedContact(inboxId, phoneNumber);
      processed += 1;
      continue;
    }

    const waId = normalizeWhatsAppWaId(phoneNumber);
    if (!waId) continue;

    const name = resolveWhatsAppContactName({
      fullName: entry.contact?.full_name,
      firstName: entry.contact?.first_name,
      waId,
    });

    const contact = await upsertWhatsAppContact(inboxId, {
      waId,
      name,
      overwriteName: true,
    });
    if (contact) processed += 1;
  }

  return processed;
}
