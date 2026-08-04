import { prisma } from "../../infrastructure/database/prisma.client.js";
import {
  asciiFallbackDisplayName,
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

function prismaErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function createContactSafe(params: {
  inboxId: string;
  identityKey: string;
  phone: string | null;
  name: string;
  avatar: string;
}) {
  return prisma.contact.create({
    data: {
      inboxId: params.inboxId,
      name: params.name,
      phone: params.phone,
      waId: params.identityKey,
      avatar: params.avatar,
    },
  });
}

export async function upsertWhatsAppContact(
  inboxId: string,
  params: {
    /** Teléfono o BSUID/LID — clave en contacts.wa_id */
    waId: string;
    name: string;
    /** Teléfono E.164 solo dígitos si se conoce */
    phone?: string | null;
    touchLastSeen?: boolean;
    overwriteName?: boolean;
  }
) {
  const identityKey = params.waId.trim();
  if (!identityKey) return null;

  const phone =
    params.phone !== undefined && params.phone !== null
      ? normalizeWhatsAppWaId(params.phone) || null
      : isFinitePhone(identityKey)
        ? identityKey
        : null;

  const incomingName = sanitizeWhatsAppDisplayName(params.name, phone || identityKey);

  const existing = await prisma.contact.findUnique({
    where: {
      inboxId_waId: {
        inboxId,
        waId: identityKey,
      },
    },
  });

  if (existing) {
    const name = resolveIncomingContactName(existing.name, incomingName, identityKey, {
      allowOverwrite: params.overwriteName ?? false,
    });

    try {
      return await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name,
          phone: phone ?? existing.phone,
          ...(params.touchLastSeen ? { lastSeen: new Date() } : {}),
        },
      });
    } catch (error) {
      console.error(
        `[contact.update] waId=${identityKey} name=${JSON.stringify(name)} err=${prismaErrorMessage(error)}`
      );
      return existing;
    }
  }

  const attempts: Array<{ name: string; avatar: string }> = [
    { name: incomingName, avatar: contactAvatarInitials(incomingName, phone || identityKey) },
    {
      name: asciiFallbackDisplayName(incomingName, phone || identityKey),
      avatar: contactAvatarInitials(phone || identityKey, phone || identityKey),
    },
    {
      name: phone || identityKey,
      avatar: contactAvatarInitials(phone || identityKey, phone || identityKey),
    },
  ];

  for (const attempt of attempts) {
    try {
      return await createContactSafe({
        inboxId,
        identityKey,
        phone,
        name: attempt.name,
        avatar: attempt.avatar,
      });
    } catch (error) {
      console.error(
        `[contact.create] attempt name=${JSON.stringify(attempt.name)} avatar=${attempt.avatar} waId=${identityKey} err=${prismaErrorMessage(error)}`
      );
    }
  }

  const raced = await prisma.contact.findUnique({
    where: { inboxId_waId: { inboxId, waId: identityKey } },
  });
  if (raced) return raced;

  console.error(`[contact.create] definitivo falló waId=${identityKey}`);
  return null;
}

function isFinitePhone(value: string): boolean {
  return /^\d{8,15}$/.test(value);
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
      phone: waId,
      name,
      overwriteName: true,
    });
    if (contact) processed += 1;
  }

  return processed;
}
