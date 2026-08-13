import {
  isWhatsAppPhoneSenderId,
  normalizeWhatsAppWaId,
} from "./whatsapp-contact.js";

export const DEFAULT_REQUEST_CONTACT_INFO_BODY =
  "Para continuar, por favor comparta su número de teléfono. WhatsApp no lo envía automáticamente cuando se utiliza un nombre de usuario.";

export const MISSING_WHATSAPP_PHONE_NOTE =
  "Este contacto no tiene número. Pídeselo con el botón oficial de WhatsApp; el cliente no tiene que escribirlo.";

export const REQUEST_CONTACT_INFO_BODY_MAX_LENGTH = 1024;

export interface MetaInboundSharedContactPhone {
  phone?: string;
  wa_id?: string;
  type?: string;
}

export interface MetaInboundSharedContact {
  name?: {
    formatted_name?: string;
    first_name?: string;
  };
  phones?: MetaInboundSharedContactPhone[];
  origin?: string | { type?: string };
  vcard?: string;
}

export type SharedContactOrigin = "contact_request" | "other";

export interface ParsedSharedContactCard {
  origin: SharedContactOrigin | null;
  formattedName: string | null;
  phones: Array<{ phone: string; waId: string | null }>;
}

function parseOrigin(raw?: unknown): SharedContactOrigin | null {
  const value =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && "type" in raw
        ? String((raw as { type?: unknown }).type ?? "")
        : "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "contact_request") return "contact_request";
  if (normalized === "other") return "other";
  return null;
}

function parseSharedPhone(entry: MetaInboundSharedContactPhone): {
  phone: string;
  waId: string | null;
} | null {
  const waIdRaw = entry.wa_id?.trim() || "";
  const phoneRaw = entry.phone?.trim() || "";
  const waId = waIdRaw && isWhatsAppPhoneSenderId(waIdRaw)
    ? normalizeWhatsAppWaId(waIdRaw)
    : null;
  const phoneDigits = phoneRaw ? normalizeWhatsAppWaId(phoneRaw) : "";
  const phone =
    phoneDigits.length >= 8 && phoneDigits.length <= 15 ? phoneDigits : waId;

  if (!phone) return null;
  return { phone, waId: waId || phone };
}

function decodeVcard(raw?: string): string {
  const trimmed = raw?.trim() || "";
  if (!trimmed) return "";
  if (/BEGIN:VCARD/i.test(trimmed)) return trimmed;
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (/BEGIN:VCARD/i.test(decoded)) return decoded;
  } catch {
    // ignore
  }
  return trimmed;
}

function phonesFromVcard(vcard?: string): Array<{ phone: string; waId: string | null }> {
  const text = decodeVcard(vcard);
  if (!text) return [];

  const found = new Map<string, { phone: string; waId: string | null }>();

  for (const match of text.matchAll(/waid=(\d{8,15})/gi)) {
    const waId = match[1];
    found.set(waId, { phone: waId, waId });
  }

  for (const match of text.matchAll(/TEL[^:]*:([^\r\n]+)/gi)) {
    const parsed = parseSharedPhone({ phone: match[1] });
    if (!parsed) continue;
    const existing = found.get(parsed.phone);
    found.set(parsed.phone, {
      phone: parsed.phone,
      waId: parsed.waId || existing?.waId || parsed.phone,
    });
  }

  return [...found.values()];
}

export function parseInboundSharedContactCards(
  contacts: MetaInboundSharedContact[] | undefined
): ParsedSharedContactCard[] {
  if (!contacts?.length) return [];

  const cards: ParsedSharedContactCard[] = [];
  for (const contact of contacts) {
    const fromPhones = (contact.phones ?? [])
      .map(parseSharedPhone)
      .filter((item): item is { phone: string; waId: string | null } => Boolean(item));
    const fromVcard = phonesFromVcard(contact.vcard);
    const phones = [...fromPhones];
    for (const item of fromVcard) {
      if (!phones.some((existing) => existing.phone === item.phone)) {
        phones.push(item);
      }
    }

    const formattedName =
      contact.name?.formatted_name?.trim() ||
      contact.name?.first_name?.trim() ||
      null;

    if (!phones.length && !formattedName) continue;

    cards.push({
      origin: parseOrigin(contact.origin),
      formattedName,
      phones,
    });
  }

  return cards;
}

/** Teléfono que el usuario compartió con el botón oficial de Meta. */
export function resolveContactRequestPhone(
  contacts: MetaInboundSharedContact[] | undefined
): string | null {
  const cards = parseInboundSharedContactCards(contacts);
  const requested = cards.find((card) => card.origin === "contact_request");
  const fallback =
    requested ??
    (cards.length === 1 && cards[0].origin !== "other" ? cards[0] : null);
  const first = fallback?.phones[0];
  return first?.waId || first?.phone || null;
}

export function isInboundContactsMessage(message: {
  type?: string;
  contacts?: unknown;
}): boolean {
  const type = (message.type ?? "").trim().toLowerCase();
  if (type === "contacts") return true;
  return Array.isArray(message.contacts) && message.contacts.length > 0;
}

export function formatInboundSharedContactsContent(
  contacts: MetaInboundSharedContact[] | undefined
): string {
  const cards = parseInboundSharedContactCards(contacts);
  if (!cards.length) return "Compartió un contacto";

  return cards
    .map((card) => {
      const number = card.phones[0]?.waId || card.phones[0]?.phone;
      if (card.origin === "contact_request" && number) {
        return `Compartió su número: ${number}`;
      }
      if (card.formattedName && number) {
        return `Compartió un contacto: ${card.formattedName} (${number})`;
      }
      if (number) return `Compartió un contacto: ${number}`;
      if (card.formattedName) return `Compartió un contacto: ${card.formattedName}`;
      return "Compartió un contacto";
    })
    .join("\n");
}

export function normalizeRequestContactInfoBody(raw?: string | null): string {
  const text = raw?.trim() || DEFAULT_REQUEST_CONTACT_INFO_BODY;
  return text.slice(0, REQUEST_CONTACT_INFO_BODY_MAX_LENGTH);
}
