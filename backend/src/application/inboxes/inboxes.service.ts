import { prisma } from "../../infrastructure/database/prisma.client.js";
import {
  buildInboxWebhookUrl,
  createWebhookVerifyToken,
} from "../../infrastructure/webhooks/webhook-url.builder.js";
import { mapInbox, mapInboxSettings } from "../mappers.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import type { CreateInboxBody, UpdateInboxSettingsBody } from "../../types/api-responses.js";
import { getProviderForChannel } from "../../shared/channel-utils.js";
import { isImplementedChannelType } from "../../shared/integration-providers.js";
import {
  BOT_PAUSE_MINUTES_MAX,
  BOT_PAUSE_MINUTES_MIN,
  clampBotPauseMinutes,
} from "../../shared/bot-pause.js";

export async function listInboxes() {
  const inboxes = await prisma.inbox.findMany({
    include: {
      conversations: { select: { unreadCount: true } },
    },
    orderBy: { name: "asc" },
  });

  return inboxes.map((inbox) => mapInbox({ ...inbox, conversations: inbox.conversations }));
}

export async function listInboxSettings() {
  const settings = await prisma.inboxSettings.findMany({
    include: { inbox: { include: { inboxAgents: true } } },
  });

  // Asegura verify token en bandejas Meta antiguas que aún no lo tienen.
  for (const item of settings) {
    if (item.provider === "meta" && !item.webhookVerifyToken) {
      const token = createWebhookVerifyToken(item.inboxId);
      await prisma.inboxSettings.update({
        where: { inboxId: item.inboxId },
        data: { webhookVerifyToken: token },
      });
      item.webhookVerifyToken = token;
    }
  }

  return settings.map((item) =>
    mapInboxSettings({
      ...item,
      assignedAgentIds: item.inbox.inboxAgents.map((row) => row.agentId),
    })
  );
}

export async function getInboxById(inboxId: string) {
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    include: {
      conversations: { select: { unreadCount: true } },
      settings: true,
      inboxAgents: true,
    },
  });

  if (!inbox || !inbox.settings) throw new NotFoundError("Bandeja no encontrada");

  return {
    inbox: mapInbox({ ...inbox, conversations: inbox.conversations }),
    settings: mapInboxSettings({
      ...inbox.settings,
      assignedAgentIds: inbox.inboxAgents.map((row) => row.agentId),
    }),
  };
}

export async function createInbox(input: CreateInboxBody) {
  if (!isImplementedChannelType(input.channelType)) {
    throw new AppError("Este canal aún no está disponible para crear bandejas");
  }

  const provider = getProviderForChannel(input.channelType);

  const inbox = await prisma.inbox.create({
    data: {
      name: input.name.trim(),
      channelType: input.channelType,
      icon: input.channelType,
      settings: {
        create: {
          detail: input.detail.trim(),
          status: provider === "meta" ? "pending" : "active",
          provider,
          providerResource: input.providerResource.trim(),
          description: input.description?.trim(),
          whatsappProvider: input.channelType === "whatsapp" ? "meta-cloud" : null,
          phoneNumberId: input.phoneNumberId?.trim(),
          businessAccountId: input.businessAccountId?.trim(),
          accessToken: input.accessToken?.trim(),
        },
      },
      inboxAgents: {
        create: (input.assignedAgentIds ?? []).map((agentId) => ({ agentId })),
      },
    },
    include: {
      settings: true,
      inboxAgents: true,
      conversations: { select: { unreadCount: true } },
    },
  });

  if (inbox.settings && provider === "meta") {
    const finalWebhook = buildInboxWebhookUrl("meta", inbox.id);
    const verifyToken = createWebhookVerifyToken(inbox.id);
    await prisma.inboxSettings.update({
      where: { inboxId: inbox.id },
      data: { webhookUrl: finalWebhook, webhookVerifyToken: verifyToken },
    });
    inbox.settings.webhookUrl = finalWebhook;
    inbox.settings.webhookVerifyToken = verifyToken;
  }

  return {
    inbox: mapInbox({ ...inbox, conversations: inbox.conversations }),
    settings: mapInboxSettings({
      ...inbox.settings!,
      assignedAgentIds: inbox.inboxAgents.map((row) => row.agentId),
    }),
  };
}

export async function updateInboxSettings(
  inboxId: string,
  body: UpdateInboxSettingsBody
) {
  const existing = await prisma.inboxSettings.findUnique({
    where: { inboxId },
    include: { inbox: { include: { inboxAgents: true } } },
  });
  if (!existing) throw new NotFoundError("Bandeja no encontrada");

  const data: { botPauseMinutes?: number } = {};
  if (body.botPauseMinutes !== undefined) {
    if (
      !Number.isFinite(body.botPauseMinutes) ||
      body.botPauseMinutes < BOT_PAUSE_MINUTES_MIN ||
      body.botPauseMinutes > BOT_PAUSE_MINUTES_MAX
    ) {
      throw new AppError(
        `botPauseMinutes debe estar entre ${BOT_PAUSE_MINUTES_MIN} y ${BOT_PAUSE_MINUTES_MAX}`,
        400,
        "INVALID_BOT_PAUSE_MINUTES"
      );
    }
    data.botPauseMinutes = clampBotPauseMinutes(body.botPauseMinutes);
  }

  if (Object.keys(data).length === 0) {
    return mapInboxSettings({
      ...existing,
      assignedAgentIds: existing.inbox.inboxAgents.map((row) => row.agentId),
    });
  }

  const updated = await prisma.inboxSettings.update({
    where: { inboxId },
    data,
    include: { inbox: { include: { inboxAgents: true } } },
  });

  return mapInboxSettings({
    ...updated,
    assignedAgentIds: updated.inbox.inboxAgents.map((row) => row.agentId),
  });
}
