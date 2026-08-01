import type { FastifyInstance } from "fastify";
import {
  processMetaWebhookPayload,
  resolveInboxForMetaWebhook,
  verifyMetaChallenge,
} from "../../../application/webhooks/meta-webhook.service.js";
import { prisma } from "../../../infrastructure/database/prisma.client.js";
import { metaChallengeQuerySchema } from "../schemas/index.js";

async function getVerifyToken(inboxId?: string): Promise<string | null> {
  if (inboxId) {
    const settings = await prisma.inboxSettings.findUnique({ where: { inboxId } });
    return settings?.webhookVerifyToken ?? null;
  }

  const metaAccount = await prisma.integrationAccount.findUnique({
    where: { provider: "meta" },
  });

  return metaAccount?.webhookUrl ? "chatpool_meta_verify" : null;
}

export async function webhookRoutes(app: FastifyInstance) {
  app.get("/webhooks/meta", async (request, reply) => {
    const query = metaChallengeQuerySchema.parse(request.query);
    const challenge = verifyMetaChallenge({
      mode: query["hub.mode"],
      verifyToken: query["hub.verify_token"],
      challenge: query["hub.challenge"],
      expectedToken: "chatpool_meta_verify",
    });

    if (!challenge) {
      return reply.status(403).send({ message: "Verificación de webhook fallida" });
    }

    return reply.status(200).send(challenge);
  });

  app.post("/webhooks/meta", async (request, reply) => {
    request.log.info({ inboxId: "global" }, "Meta webhook POST recibido");
    const result = await processMetaWebhookPayload(request.body as never);
    for (const event of result.events) {
      if (event.kind === "message") {
        request.log.info(
          event,
          `Mensaje entrante: ${event.contactName} → "${event.contentPreview}" [${event.inboxName}]`
        );
      } else if (event.kind === "contact_sync") {
        request.log.info(
          event,
          `Sync de contactos WhatsApp: ${event.syncedContacts} contacto(s) [${event.inboxName}]`
        );
      }
    }
    request.log.info({ processed: result.processed, events: result.events }, "Meta webhook procesado");
    return reply.send({ success: true, processed: result.processed });
  });

  app.get("/webhooks/meta/:inboxId", async (request, reply) => {
    const { inboxId } = request.params as { inboxId: string };
    const query = metaChallengeQuerySchema.parse(request.query);
    const settings = await resolveInboxForMetaWebhook(inboxId);

    const challenge = verifyMetaChallenge({
      mode: query["hub.mode"],
      verifyToken: query["hub.verify_token"],
      challenge: query["hub.challenge"],
      expectedToken: settings?.webhookVerifyToken ?? (await getVerifyToken(inboxId)),
    });

    if (!challenge) {
      return reply.status(403).send({ message: "Verificación de webhook fallida" });
    }

    return reply.status(200).send(challenge);
  });

  app.post("/webhooks/meta/:inboxId", async (request, reply) => {
    const { inboxId } = request.params as { inboxId: string };
    request.log.info({ inboxId }, "Meta webhook POST recibido");
    const result = await processMetaWebhookPayload(request.body as never, inboxId);
    for (const event of result.events) {
      if (event.kind === "message") {
        request.log.info(
          event,
          `Mensaje entrante: ${event.contactName} → "${event.contentPreview}" [${event.inboxName}]`
        );
      } else if (event.kind === "contact_sync") {
        request.log.info(
          event,
          `Sync de contactos WhatsApp: ${event.syncedContacts} contacto(s) [${event.inboxName}]`
        );
      }
    }
    request.log.info({ inboxId, processed: result.processed, events: result.events }, "Meta webhook procesado");
    return reply.send({ success: true, processed: result.processed });
  });
}
