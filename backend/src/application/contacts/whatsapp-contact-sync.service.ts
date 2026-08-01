import { prisma } from "../../infrastructure/database/prisma.client.js";
import {
  contactAvatarInitials,
  normalizeWhatsAppWaId,
  resolveIncomingContactName,
  resolveWhatsAppContactName,
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

  const incomingName = params.name.trim() || waId;

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

    return prisma.contact.update({
      where: { id: existing.id },
      data: {
        name,
        phone: waId,
        ...(params.touchLastSeen ? { lastSeen: new Date() } : {}),
      },
    });
  }

  const name = incomingName;

  return prisma.contact.create({
    data: {
      inboxId,
      name,
      phone: waId,
      waId,
      avatar: contactAvatarInitials(name),
    },
  });
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

    await upsertWhatsAppContact(inboxId, { waId, name, overwriteName: true });
    processed += 1;
  }

  return processed;
}
