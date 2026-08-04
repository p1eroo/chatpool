export function normalizeWhatsAppWaId(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "");
}

/** ¿Parece un teléfono E.164 y no un BSUID/LID/username de Meta? */
export function isWhatsAppPhoneSenderId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/@[a-z]*lid$/i.test(trimmed)) return false;
  if (/^[A-Z]{2}\./.test(trimmed)) return false;
  if (/^whatsapp:/i.test(trimmed)) return false;
  if (/[A-Za-z]/.test(trimmed)) return false;
  const digits = normalizeWhatsAppWaId(trimmed);
  return digits.length >= 8 && digits.length <= 15;
}

export function normalizeWhatsAppIdentityKey(raw: string): string {
  const trimmed = raw.trim().replace(/^whatsapp:/i, "");
  if (!trimmed) return "";
  if (isWhatsAppPhoneSenderId(trimmed)) {
    return normalizeWhatsAppWaId(trimmed);
  }
  // BSUID / LID / opaco: clave estable ASCII-safe
  return trimmed.replace(/\s+/g, "").slice(0, 128);
}

/**
 * Limpia nombres de perfil de WhatsApp para Prisma/JSON/Postgres.
 * Conserva emojis válidos; elimina controles y surrogates rotos.
 */
export function sanitizeWhatsAppDisplayName(raw: string, fallback: string): string {
  const fallbackSafe = (fallback.trim() || "WhatsApp").slice(0, 120);

  let cleaned = "";
  try {
    cleaned = Array.from(raw.normalize("NFC"))
      .filter((char) => {
        const code = char.codePointAt(0);
        if (code === undefined) return false;
        if (code >= 0xd800 && code <= 0xdfff) return false;
        if (code <= 0x08) return false;
        if (code === 0x0b || code === 0x0c) return false;
        if (code >= 0x0e && code <= 0x1f) return false;
        if (code === 0x7f) return false;
        if (code >= 0x80 && code <= 0x9f) return false;
        return true;
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    cleaned = "";
  }

  if (cleaned.length > 120) {
    cleaned = Array.from(cleaned).slice(0, 120).join("").trim();
  }

  return cleaned || fallbackSafe;
}

/** Solo A-Z / 0-9 para avatar: evita romper el protocolo JSON de Prisma. */
export function contactAvatarInitials(name: string, fallbackDigits = ""): string {
  const letters = (name.toLocaleUpperCase().match(/[A-Z0-9]/g) ?? []).join("");
  if (letters.length >= 2) return letters.slice(0, 2);
  if (letters.length === 1) {
    const digit = (fallbackDigits.match(/\d/g) ?? []).join("").slice(-1);
    return digit ? letters + digit : `${letters}${letters}`;
  }
  const digits = (fallbackDigits.match(/\d/g) ?? []).join("");
  if (digits.length >= 2) return digits.slice(-2);
  return "WA";
}

/** Nombre ASCII de respaldo (sin emoji) si Prisma rechaza el unicode. */
export function asciiFallbackDisplayName(raw: string, fallback: string): string {
  const ascii = raw
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return ascii || fallback.slice(0, 120) || "WhatsApp";
}

export function resolveWhatsAppContactName(params: {
  fullName?: string | null;
  firstName?: string | null;
  username?: string | null;
  waId: string;
}): string {
  const fullName = params.fullName?.trim();
  if (fullName) return sanitizeWhatsAppDisplayName(fullName, params.waId);

  const firstName = params.firstName?.trim();
  if (firstName) return sanitizeWhatsAppDisplayName(firstName, params.waId);

  const username = params.username?.trim();
  if (username) {
    const withAt = username.startsWith("@") ? username : `@${username}`;
    return sanitizeWhatsAppDisplayName(withAt, params.waId);
  }

  return params.waId;
}

export interface InboundWhatsAppIdentity {
  /** Clave única en contacts.wa_id (teléfono o BSUID/LID). */
  identityKey: string;
  /** Teléfono E.164 solo dígitos, si Meta lo envió. */
  phone: string | null;
  displayName: string;
  username: string | null;
}

export function resolveInboundWhatsAppIdentity(params: {
  from?: string | null;
  fromUserId?: string | null;
  contact?: {
    wa_id?: string | null;
    user_id?: string | null;
    profile?: { name?: string | null; username?: string | null } | null;
  } | null;
}): InboundWhatsAppIdentity | null {
  const profileName = params.contact?.profile?.name?.trim() || null;
  const username = params.contact?.profile?.username?.trim() || null;

  const phoneRaw = [params.contact?.wa_id, params.from].find(
    (value) => value && isWhatsAppPhoneSenderId(value)
  );
  const phone = phoneRaw ? normalizeWhatsAppWaId(phoneRaw) : null;

  const bsuidRaw = [
    params.fromUserId,
    params.contact?.user_id,
    params.from && !phoneRaw ? params.from : null,
    params.contact?.wa_id && !phoneRaw ? params.contact.wa_id : null,
  ].find((value) => Boolean(value?.trim()));

  const identityKey = phone || (bsuidRaw ? normalizeWhatsAppIdentityKey(bsuidRaw) : "");
  if (!identityKey) return null;

  const displayName = resolveWhatsAppContactName({
    fullName: profileName,
    username,
    waId: phone || identityKey,
  });

  return {
    identityKey,
    phone,
    displayName,
    username: username ? (username.startsWith("@") ? username : `@${username}`) : null,
  };
}

/** Nombre sin identidad real (vacío o solo el número / identity key). */
export function isPlaceholderContactName(name: string, waId: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (normalizeWhatsAppWaId(trimmed) === waId) return true;
  return trimmed === waId;
}

export function resolveIncomingContactName(
  existingName: string,
  incomingName: string,
  waId: string,
  options?: { allowOverwrite?: boolean }
): string {
  const incoming = sanitizeWhatsAppDisplayName(incomingName.trim() || waId, waId);

  if (options?.allowOverwrite) {
    return incoming;
  }

  const existing = sanitizeWhatsAppDisplayName(existingName, waId);
  if (existing && !isPlaceholderContactName(existing, waId)) {
    return existing;
  }

  if (!isPlaceholderContactName(incoming, waId)) {
    return incoming;
  }

  return existing || waId;
}
