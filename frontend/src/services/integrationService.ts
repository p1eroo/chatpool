import { apiRequest } from "@/api/client";
import { env } from "@/config/env";
import { isValidMetaCredentials } from "@/lib/metaApi";
import { buildInboxWebhookUrl, buildProviderWebhookUrl } from "@/lib/webhooks";
import { filterImplementedIntegrationAccounts } from "@/lib/integrationProviders";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { useIntegrationStore } from "@/store/integrationStore";
import type {
  IntegrationAccountDto,
  MetaInboxCredentialsDto,
  RegisterWebhookResponse,
  VerifyMetaConnectionResponse,
} from "@/types/api";
import type { IntegrationProvider } from "@/types";

function mockVerifyMetaConnection(
  inboxId: string,
  credentials: MetaInboxCredentialsDto
): VerifyMetaConnectionResponse {
  if (!isValidMetaCredentials(credentials)) {
    return { ok: false, error: "Completa Phone Number ID, WABA ID y token de acceso." };
  }

  const settings = useInboxSettingsStore.getState().getByInboxId(inboxId);
  if (!settings) {
    return { ok: false, error: "Bandeja no encontrada." };
  }

  useInboxSettingsStore.getState().updateSettings(inboxId, {
    phoneNumberId: credentials.phoneNumberId.trim(),
    businessAccountId: credentials.businessAccountId.trim(),
    apiKey: credentials.accessToken.trim(),
    status: "active",
    webhookUrl: settings.webhookUrl ?? buildInboxWebhookUrl("meta", inboxId),
  });

  useIntegrationStore.getState().setConnected("meta", true);

  return {
    ok: true,
    phoneNumber: settings.detail,
    verifiedName: settings.providerResource,
    webhookSubscribed: true,
  };
}

async function httpVerifyMetaConnection(
  inboxId: string,
  credentials: MetaInboxCredentialsDto
): Promise<VerifyMetaConnectionResponse> {
  return apiRequest<VerifyMetaConnectionResponse>("/integrations/meta/verify", {
    method: "POST",
    body: { inboxId, ...credentials },
  });
}

function mockRegisterWebhook(
  inboxId: string,
  provider: IntegrationProvider
): RegisterWebhookResponse {
  const webhookUrl = buildInboxWebhookUrl(provider, inboxId);
  const verifyToken = `cp_${inboxId.slice(-8)}_${Date.now().toString(36)}`;

  useInboxSettingsStore.getState().updateSettings(inboxId, { webhookUrl });

  return {
    webhookUrl,
    verifyToken,
    subscribed: provider === "meta",
  };
}

async function httpRegisterWebhook(
  inboxId: string,
  provider: IntegrationProvider
): Promise<RegisterWebhookResponse> {
  return apiRequest<RegisterWebhookResponse>("/integrations/webhooks/register", {
    method: "POST",
    body: { inboxId, provider },
  });
}

export const integrationService = {
  async getAccounts(): Promise<IntegrationAccountDto[]> {
    if (env.useMock) {
      return filterImplementedIntegrationAccounts(
        useIntegrationStore.getState().accounts
      ).map((account) => ({
        ...account,
        webhookUrl: account.webhookUrl ?? buildProviderWebhookUrl(account.provider),
      }));
    }
    return apiRequest<IntegrationAccountDto[]>("/integrations/accounts");
  },

  getInboxesForProvider(provider: IntegrationProvider) {
    return useInboxSettingsStore
      .getState()
      .settings.filter((item) => item.provider === provider);
  },

  async verifyMetaConnection(
    inboxId: string,
    credentials: MetaInboxCredentialsDto
  ): Promise<VerifyMetaConnectionResponse> {
    if (env.useMock) {
      await delay(800);
      return mockVerifyMetaConnection(inboxId, credentials);
    }
    return httpVerifyMetaConnection(inboxId, credentials);
  },

  async registerInboxWebhook(
    inboxId: string,
    provider: IntegrationProvider
  ): Promise<RegisterWebhookResponse> {
    if (env.useMock) {
      await delay(400);
      return mockRegisterWebhook(inboxId, provider);
    }
    return httpRegisterWebhook(inboxId, provider);
  },

  buildInboxWebhookUrl,
  buildProviderWebhookUrl,
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
