import type { ChannelType, IntegrationProvider } from "@/types";

/** Proveedores con backend implementado. Añade aquí al desplegar uno nuevo. */
export const IMPLEMENTED_INTEGRATION_PROVIDERS = ["meta"] as const satisfies readonly IntegrationProvider[];

export type ImplementedIntegrationProvider = (typeof IMPLEMENTED_INTEGRATION_PROVIDERS)[number];

/** Canales disponibles en el wizard de bandejas. */
export const IMPLEMENTED_CHANNEL_TYPES = ["whatsapp"] as const satisfies readonly ChannelType[];

export type ImplementedChannelType = (typeof IMPLEMENTED_CHANNEL_TYPES)[number];

const implementedProviderSet = new Set<string>(IMPLEMENTED_INTEGRATION_PROVIDERS);
const implementedChannelSet = new Set<string>(IMPLEMENTED_CHANNEL_TYPES);

export function isImplementedIntegrationProvider(
  provider: string
): provider is ImplementedIntegrationProvider {
  return implementedProviderSet.has(provider);
}

export function isImplementedChannelType(channel: string): channel is ImplementedChannelType {
  return implementedChannelSet.has(channel);
}

export function getProviderWebhookHelp(provider: IntegrationProvider): string | null {
  switch (provider) {
    case "meta":
      return "Callback URL para Meta Cloud API. Verifica el token en el backend al recibir el challenge GET.";
    case "email":
      return "Endpoint para recibir correos entrantes vía webhook o relay SMTP.";
    case "website":
      return "Endpoint del widget de chat web para mensajes entrantes.";
    default:
      return null;
  }
}

export function filterImplementedIntegrationAccounts<
  T extends { provider: IntegrationProvider },
>(accounts: T[]): T[] {
  return accounts.filter((account) => isImplementedIntegrationProvider(account.provider));
}

export function getImplementedChannelWizardOptions<
  T extends { value: ChannelType },
>(options: T[]): T[] {
  return options.filter((option) => isImplementedChannelType(option.value));
}
