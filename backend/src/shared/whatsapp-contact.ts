export function normalizeWhatsAppWaId(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "");
}

export function resolveWhatsAppContactName(params: {
  fullName?: string | null;
  firstName?: string | null;
  waId: string;
}): string {
  const fullName = params.fullName?.trim();
  if (fullName) return fullName;

  const firstName = params.firstName?.trim();
  if (firstName) return firstName;

  return params.waId;
}

export function contactAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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
  const incoming = incomingName.trim() || waId;

  if (options?.allowOverwrite) {
    return incoming;
  }

  const existing = existingName.trim();
  if (existing && !isPlaceholderContactName(existing, waId)) {
    return existing;
  }

  if (!isPlaceholderContactName(incoming, waId)) {
    return incoming;
  }

  return existing || waId;
}
