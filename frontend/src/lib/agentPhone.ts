import { APP_PHONE_PREFIX } from "@/lib/locale";

export function sanitizeAgentPhoneInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 9);
}

export function formatPhoneInputDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function getAgentPhoneValidationError(
  input: string,
  options?: { optional?: boolean }
): string | null {
  const digits = sanitizeAgentPhoneInput(input);
  if (!digits) return options?.optional ? null : "El número es obligatorio";
  if (!digits.startsWith("9")) return "Debe comenzar con 9";
  if (digits.length !== 9) return `Debe tener 9 dígitos (${digits.length}/9)`;
  return null;
}

export function isValidAgentPhoneInput(
  input: string,
  options?: { optional?: boolean }
): boolean {
  const digits = sanitizeAgentPhoneInput(input);
  if (!digits) return options?.optional ?? false;
  return digits.length === 9 && digits.startsWith("9");
}

export function normalizeAgentPhone(
  input: string,
  options?: { optional?: boolean }
): string | null {
  const digits = sanitizeAgentPhoneInput(input);
  if (!digits) return options?.optional ? "" : null;
  if (!isValidAgentPhoneInput(digits)) return null;

  return `${APP_PHONE_PREFIX} ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function phoneToInputValue(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("51") ? digits.slice(2) : digits;
  return sanitizeAgentPhoneInput(local);
}
