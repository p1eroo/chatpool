import type { FastifyInstance } from "fastify";
import {
  listIntegrationAccounts,
  registerInboxWebhook,
  verifyMetaConnection,
} from "../../../application/integrations/integration.service.js";
import {
  registerWebhookBodySchema,
  verifyMetaBodySchema,
} from "../schemas/index.js";
import { authenticate } from "../plugins/error-handler.plugin.js";

export async function integrationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/integrations/accounts", async (_request, reply) => {
    const accounts = await listIntegrationAccounts();
    return reply.send(accounts);
  });

  app.post("/integrations/meta/verify", async (request, reply) => {
    const body = verifyMetaBodySchema.parse(request.body);
    const result = await verifyMetaConnection(body);
    return reply.send(result);
  });

  app.post("/integrations/webhooks/register", async (request, reply) => {
    const body = registerWebhookBodySchema.parse(request.body);
    const result = await registerInboxWebhook(body.inboxId, body.provider);
    return reply.send(result);
  });
}
