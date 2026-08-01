import type { MetaInboxCredentialsDto } from "@/types/api";

/** Campos de suscripción requeridos por Meta Cloud API en el webhook. */
export const META_WEBHOOK_FIELDS = [
  "messages",
  "message_deliveries",
  "message_reads",
  "message_echoes",
] as const;

export function isValidMetaCredentials(credentials: Partial<MetaInboxCredentialsDto>): boolean {
  return Boolean(
    credentials.phoneNumberId?.trim() &&
      credentials.businessAccountId?.trim() &&
      credentials.accessToken?.trim()
  );
}

export function maskAccessToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}
