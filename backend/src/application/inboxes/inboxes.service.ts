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

type InboxAgentRow = { agentId: string; autoAssign: boolean };

function mapSettingsWithAgents(
  settings: Parameters<typeof mapInboxSettings>[0] & {
    autoAssignEnabled?: boolean | null;
  },
  inboxAgents: InboxAgentRow[]
) {
  return mapInboxSettings({
    ...settings,
    assignedAgentIds: inboxAgents.map((row) => row.agentId),
    autoAssignAgentIds: inboxAgents
      .filter((row) => row.autoAssign)
      .map((row) => row.agentId),
  });
}

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

  return settings.map((item) => mapSettingsWithAgents(item, item.inbox.inboxAgents));
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
    settings: mapSettingsWithAgents(inbox.settings, inbox.inboxAgents),
  };
}

export async function createInbox(input: CreateInboxBody) {
  if (!isImplementedChannelType(input.channelType)) {
    throw new AppError("Este canal aún no está disponible para crear bandejas");
  }

  const assignedAgentIds = [
    ...new Set((input.assignedAgentIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ];
  if (assignedAgentIds.length > 0) {
    const existingAgents = await prisma.agent.findMany({
      where: { id: { in: assignedAgentIds } },
      select: { id: true },
    });
    if (existingAgents.length !== assignedAgentIds.length) {
      throw new AppError(
        "Uno o más agentes asignados no existen",
        422,
        "INVALID_ASSIGNED_AGENTS"
      );
    }
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
          autoAssignEnabled: false,
        },
      },
      inboxAgents: {
        create: assignedAgentIds.map((agentId) => ({ agentId, autoAssign: true })),
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
    settings: mapSettingsWithAgents(inbox.settings!, inbox.inboxAgents),
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

  const membershipIds = new Set(existing.inbox.inboxAgents.map((row) => row.agentId));
  const data: { botPauseMinutes?: number; autoAssignEnabled?: boolean } = {};

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

  if (body.autoAssignEnabled !== undefined) {
    data.autoAssignEnabled = body.autoAssignEnabled;
  }

  if (body.autoAssignAgentIds !== undefined) {
    const uniquePoolIds = [
      ...new Set(body.autoAssignAgentIds.map((id) => id.trim()).filter(Boolean)),
    ];
    for (const agentId of uniquePoolIds) {
      if (!membershipIds.has(agentId)) {
        throw new AppError(
          "Uno o más agentes del pool no pertenecen a esta bandeja",
          422,
          "INVALID_AUTO_ASSIGN_AGENTS"
        );
      }
    }

    const inPool = new Set(uniquePoolIds);
    await prisma.$transaction(
      existing.inbox.inboxAgents.map((row) =>
        prisma.inboxAgent.update({
          where: {
            inboxId_agentId: { inboxId, agentId: row.agentId },
          },
          data: { autoAssign: inPool.has(row.agentId) },
        })
      )
    );
  }

  if (Object.keys(data).length === 0 && body.autoAssignAgentIds === undefined) {
    return mapSettingsWithAgents(existing, existing.inbox.inboxAgents);
  }

  const updated =
    Object.keys(data).length > 0
      ? await prisma.inboxSettings.update({
          where: { inboxId },
          data,
          include: { inbox: { include: { inboxAgents: true } } },
        })
      : await prisma.inboxSettings.findUniqueOrThrow({
          where: { inboxId },
          include: { inbox: { include: { inboxAgents: true } } },
        });

  return mapSettingsWithAgents(updated, updated.inbox.inboxAgents);
}
