export function normalizeWhatsAppWaId(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "");
}

/**
 * Limpia nombres de perfil de WhatsApp para Prisma/JSON/Postgres:
 * quita controles, surrogates rotos y normaliza unicode (emojis OK vía code points).
 */
export function sanitizeWhatsAppDisplayName(raw: string, fallback: string): string {
  const fallbackSafe = fallback.trim() || "WhatsApp";

  let cleaned = "";
  try {
    cleaned = Array.from(raw.normalize("NFC"))
      .filter((char) => {
        const code = char.codePointAt(0);
        if (code === undefined) return false;
        // UTF-16 surrogates sueltos (rompen el protocolo JSON de Prisma).
        if (code >= 0xd800 && code <= 0xdfff) return false;
        // Controles C0/C1 salvo tab/LF/CR.
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

export function resolveWhatsAppContactName(params: {
  fullName?: string | null;
  firstName?: string | null;
  waId: string;
}): string {
  const fullName = params.fullName?.trim();
  if (fullName) return sanitizeWhatsAppDisplayName(fullName, params.waId);

  const firstName = params.firstName?.trim();
  if (firstName) return sanitizeWhatsAppDisplayName(firstName, params.waId);

  return params.waId;
}

/** Iniciales seguras: usa code points (emoji completo), no char UTF-16 suelto. */
export function contactAvatarInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = Array.from(parts[0])[0] ?? "";
    const second = Array.from(parts[1])[0] ?? "";
    const initials = `${first}${second}`.toLocaleUpperCase();
    return sanitizeWhatsAppDisplayName(initials, "?").slice(0, 8) || "?";
  }

  const chars = Array.from(trimmed).slice(0, 2).join("");
  return sanitizeWhatsAppDisplayName(chars.toLocaleUpperCase(), "?") || "?";
}

/** Nombre sin identidad real (vacío o solo el número). */
export function isPlaceholderContactName(name: string, waId: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return normalizeWhatsAppWaId(trimmed) === waId;
}

/**
 * Al actualizar un contacto existente, conserva nombres ya cargados (sync/manual)
 * salvo que el actual sea solo un placeholder y el entrante traiga un nombre real.
 * Con allowOverwrite (sync WA Business) siempre aplica el nombre entrante.
 */
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
