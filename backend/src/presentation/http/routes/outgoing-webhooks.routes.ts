import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createOutgoingWebhook,
  deleteOutgoingWebhook,
  listOutgoingWebhooks,
  OUTGOING_WEBHOOK_EVENTS,
  updateOutgoingWebhook,
} from "../../../application/webhooks/outbound-webhook.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";
import { requirePermission } from "../plugins/require-permission.plugin.js";

const subscriptionsSchema = z
  .array(z.enum(OUTGOING_WEBHOOK_EVENTS))
  .min(1, "Selecciona al menos un evento");

const createBodySchema = z.object({
  inboxId: z.string().min(1),
  url: z.string().url(),
  name: z.string().trim().max(120).nullable().optional(),
  subscriptions: subscriptionsSchema,
  enabled: z.boolean().optional(),
});

const updateBodySchema = z.object({
  url: z.string().url().optional(),
  name: z.string().trim().max(120).nullable().optional(),
  subscriptions: subscriptionsSchema.optional(),
  enabled: z.boolean().optional(),
});

const listQuerySchema = z.object({
  inboxId: z.string().min(1).optional(),
});

export async function outgoingWebhooksRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requirePermission("manageIntegrations"));

  app.get("/outgoing-webhooks", async (request, reply) => {
    const { inboxId } = listQuerySchema.parse(request.query ?? {});
    return reply.send(await listOutgoingWebhooks(inboxId));
  });

  app.get("/outgoing-webhooks/events", async (_request, reply) => {
    return reply.send({ events: OUTGOING_WEBHOOK_EVENTS });
  });

  app.post("/outgoing-webhooks", async (request, reply) => {
    const body = createBodySchema.parse(request.body ?? {});
    const webhook = await createOutgoingWebhook(body);
    return reply.status(201).send(webhook);
  });

  app.patch("/outgoing-webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateBodySchema.parse(request.body ?? {});
    const webhook = await updateOutgoingWebhook(id, body);
    return reply.send(webhook);
  });

  app.delete("/outgoing-webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteOutgoingWebhook(id);
    return reply.status(204).send();
  });
}
