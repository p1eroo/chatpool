import { prisma } from "../../infrastructure/database/prisma.client.js";
import { metaApiClient } from "../../infrastructure/meta/meta-api.client.js";
import {
  buildInboxWebhookUrl,
  buildProviderWebhookUrl,
  createWebhookVerifyToken,
} from "../../infrastructure/webhooks/webhook-url.builder.js";
import { AppError, NotFoundError } from "../../domain/errors.js";

export async function listIntegrationAccounts() {
  const accounts = await prisma.integrationAccount.findMany({
    orderBy: { name: "asc" },
  });

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    provider: account.provider,
    description: account.description,
    connected: account.connected,
    webhookUrl: account.webhookUrl ?? buildProviderWebhookUrl(account.provider),
  }));
}

export async function verifyMetaConnection(input: {
  inboxId: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken?: string;
  syncWhatsAppContacts?: boolean;
}) {
  const settings = await prisma.inboxSettings.findUnique({
    where: { inboxId: input.inboxId },
    include: { inbox: true },
  });

  if (!settings) {
    throw new NotFoundError("Bandeja no encontrada");
  }

  if (settings.provider !== "meta") {
    throw new AppError("Esta bandeja no usa Meta API");
  }

  const accessToken = input.accessToken?.trim() || settings.accessToken?.trim();
  if (!accessToken) {
    return {
      ok: false as const,
      error: "Ingresa el token de acceso de Meta o créalo en el wizard de la bandeja.",
    };
  }

  let phoneNumber: string | undefined;
  let verifiedName: string | undefined;
  let webhookSubscribed = false;

  try {
    const metaInfo = await metaApiClient.getPhoneNumber(
      input.phoneNumberId.trim(),
      accessToken
    );
    phoneNumber = metaInfo.phoneNumber ?? settings.detail;
    verifiedName = metaInfo.verifiedName ?? settings.providerResource;

    webhookSubscribed = await metaApiClient.subscribeAppToWaba(
      input.businessAccountId.trim(),
      accessToken
    );
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Error al conectar con Meta",
    };
  }

  const verifyToken = settings.webhookVerifyToken ?? createWebhookVerifyToken(input.inboxId);
  const webhookUrl = buildInboxWebhookUrl("meta", input.inboxId);

  await prisma.inboxSettings.update({
    where: { inboxId: input.inboxId },
    data: {
      phoneNumberId: input.phoneNumberId.trim(),
      businessAccountId: input.businessAccountId.trim(),
      accessToken,
      webhookUrl,
      webhookVerifyToken: verifyToken,
      status: "active",
      detail: phoneNumber ?? settings.detail,
      providerResource: verifiedName ?? settings.providerResource,
    },
  });

  await prisma.integrationAccount.update({
    where: { provider: "meta" },
    data: { connected: true },
  });

  let contactSyncRequested = false;
  let contactSyncError: string | undefined;

  if (input.syncWhatsAppContacts !== false) {
    try {
      await metaApiClient.requestSmbAppStateSync(input.phoneNumberId.trim(), accessToken);
      contactSyncRequested = true;
    } catch (error) {
      contactSyncError =
        error instanceof Error ? error.message : "No se pudo solicitar sync de contactos";
    }
  }

  return {
    ok: true as const,
    phoneNumber,
    verifiedName,
    webhookSubscribed,
    contactSyncRequested,
    contactSyncError,
  };
}

export async function registerInboxWebhook(inboxId: string, provider: "meta" | "email" | "website") {
  const settings = await prisma.inboxSettings.findUnique({ where: { inboxId } });
  if (!settings) {
    throw new NotFoundError("Bandeja no encontrada");
  }

  const verifyToken = settings.webhookVerifyToken ?? createWebhookVerifyToken(inboxId);
  const webhookUrl = buildInboxWebhookUrl(provider, inboxId);

  await prisma.inboxSettings.update({
    where: { inboxId },
    data: { webhookUrl, webhookVerifyToken: verifyToken },
  });

  return {
    webhookUrl,
    verifyToken,
    subscribed: provider === "meta",
  };
}

export async function getInboxesForProvider(provider: "meta" | "email" | "website") {
  return prisma.inboxSettings.findMany({
    where: { provider },
    include: { inbox: true },
  });
}
