import { env } from "@/config/env";
import type { IntegrationProvider } from "@/types";

/** Webhook global del proveedor (p. ej. callback único de Meta). */
export function buildProviderWebhookUrl(provider: IntegrationProvider): string {
  return `${env.webhookBaseUrl}/${provider}`;
}

/** Webhook por bandeja, estilo Chatwoot: /webhooks/{provider}/{inboxId}. */
export function buildInboxWebhookUrl(provider: IntegrationProvider, inboxId: string): string {
  return `${env.webhookBaseUrl}/${provider}/${inboxId}`;
}
