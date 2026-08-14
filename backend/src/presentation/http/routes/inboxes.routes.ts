import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createInbox,
  getInboxById,
  getInboxMetaCredentials,
  listInboxes,
  listInboxSettings,
  updateInboxSettings,
} from "../../../application/inboxes/inboxes.service.js";
import {
  BOT_PAUSE_MINUTES_MAX,
  BOT_PAUSE_MINUTES_MIN,
} from "../../../shared/bot-pause.js";
import {
  createLabelForInbox,
  deleteLabelForInbox,
  listAllLabels,
  listLabelsForInbox,
  updateLabelForInbox,
} from "../../../application/labels/labels.service.js";
import { listWhatsAppTemplatesForInbox } from "../../../application/whatsapp/whatsapp-templates.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";
import { requirePermission } from "../plugins/require-permission.plugin.js";

const createInboxSchema = z.object({
  name: z.string().min(1),
  channelType: z.enum([
    "website",
    "email",
    "whatsapp",
    "facebook",
    "instagram",
    "telegram",
    "sms",
    "api",
  ]),
  detail: z.string().min(1),
  providerResource: z.string().min(1),
  description: z.string().optional(),
  assignedAgentIds: z.array(z.string()).optional(),
  phoneNumberId: z.string().optional(),
  businessAccountId: z.string().optional(),
  accessToken: z.string().optional(),
});

const createLabelSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const updateInboxSettingsSchema = z.object({
  botPauseMinutes: z
    .number()
    .int()
    .min(BOT_PAUSE_MINUTES_MIN)
    .max(BOT_PAUSE_MINUTES_MAX)
    .optional(),
  autoAssignEnabled: z.boolean().optional(),
  autoAssignAgentIds: z.array(z.string()).optional(),
});

export async function inboxesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/inboxes", async (_request, reply) => {
    return reply.send(await listInboxes());
  });

  app.get("/inboxes/settings", async (_request, reply) => {
    return reply.send(await listInboxSettings());
  });

  app.get("/labels", async (_request, reply) => {
    return reply.send(await listAllLabels());
  });

  app.get("/inboxes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(await getInboxById(id));
  });

  app.get(
    "/inboxes/:inboxId/meta-credentials",
    { preHandler: requirePermission("manageInboxes") },
    async (request, reply) => {
      const { inboxId } = request.params as { inboxId: string };
      return reply.send(await getInboxMetaCredentials(inboxId));
    }
  );

  app.post("/inboxes", { preHandler: requirePermission("manageInboxes") }, async (request, reply) => {
    const body = createInboxSchema.parse(request.body);
    return reply.status(201).send(await createInbox(body));
  });

  app.patch(
    "/inboxes/:id/settings",
    { preHandler: requirePermission("manageInboxes") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateInboxSettingsSchema.parse(request.body ?? {});
      return reply.send(await updateInboxSettings(id, body));
    }
  );

  app.get("/inboxes/:inboxId/labels", async (request, reply) => {
    const { inboxId } = request.params as { inboxId: string };
    return reply.send(await listLabelsForInbox(inboxId));
  });

  app.get(
    "/inboxes/:inboxId/whatsapp-templates",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const { inboxId } = request.params as { inboxId: string };
      const user = request.user as { sub: string };
      return reply.send(await listWhatsAppTemplatesForInbox(inboxId, user.sub));
    }
  );

  app.post(
    "/inboxes/:inboxId/labels",
    { preHandler: requirePermission("manageLabels") },
    async (request, reply) => {
      const { inboxId } = request.params as { inboxId: string };
      const body = createLabelSchema.parse(request.body);
      return reply.status(201).send(await createLabelForInbox(inboxId, body));
    }
  );

  app.patch(
    "/inboxes/:inboxId/labels/:labelId",
    { preHandler: requirePermission("manageLabels") },
    async (request, reply) => {
      const { inboxId, labelId } = request.params as {
        inboxId: string;
        labelId: string;
      };
      const body = createLabelSchema.parse(request.body);
      return reply.send(await updateLabelForInbox(inboxId, labelId, body));
    }
  );

  app.delete(
    "/inboxes/:inboxId/labels/:labelId",
    { preHandler: requirePermission("manageLabels") },
    async (request, reply) => {
      const { inboxId, labelId } = request.params as {
        inboxId: string;
        labelId: string;
      };
      return reply.send(await deleteLabelForInbox(inboxId, labelId));
    }
  );
}
