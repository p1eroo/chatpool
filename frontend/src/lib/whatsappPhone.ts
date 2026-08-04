import { APP_PHONE_PREFIX } from "@/lib/locale";

/** Solo dígitos del número local PE (9xxxxxxxx), máx 9. */
export function sanitizeLocalWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("51") && digits.length > 9 ? digits.slice(2) : digits;
  return local.slice(0, 9);
}

export function formatLocalWhatsAppPhoneDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function getWhatsAppPhoneValidationError(raw: string): string | null {
  const digits = sanitizeLocalWhatsAppPhone(raw);
  if (!digits) return "El número es obligatorio";
  if (!digits.startsWith("9")) return "Debe comenzar con 9";
  if (digits.length !== 9) return `Debe tener 9 dígitos (${digits.length}/9)`;
  return null;
}

/** E.164 solo dígitos para API Meta (51987654321). */
export function toWhatsAppApiPhone(raw: string): string | null {
  if (getWhatsAppPhoneValidationError(raw)) return null;
  return `51${sanitizeLocalWhatsAppPhone(raw)}`;
}

export function whatsappPhonePrefixLabel(): string {
  return APP_PHONE_PREFIX;
}
