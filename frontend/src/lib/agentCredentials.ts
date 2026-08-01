export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function getUsernameValidationError(value: string): string | null {
  const username = normalizeUsername(value);
  if (!username) return "El usuario es obligatorio";
  if (username.length < 3) return "Mínimo 3 caracteres";
  if (username.length > 32) return "Máximo 32 caracteres";
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return "Solo letras, números, punto, guion o guion bajo";
  }
  return null;
}

export function isValidUsername(value: string): boolean {
  return getUsernameValidationError(value) === null;
}

export function getPasswordValidationError(value: string): string | null {
  if (!value) return "La contraseña es obligatoria";
  if (value.length < 8) return "Mínimo 8 caracteres";
  return null;
}

export function isValidPassword(value: string): boolean {
  return getPasswordValidationError(value) === null;
}

export function deriveUsernameFromName(name: string, fallbackId: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  if (slug.length >= 3) return slug.slice(0, 32);
  return `agente.${fallbackId.slice(-6)}`;
}
