import type { FastifyInstance } from "fastify";
import {
  processMetaWebhookPayload,
  resolveInboxForMetaWebhook,
  verifyMetaChallenge,
} from "../../../application/webhooks/meta-webhook.service.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../../infrastructure/database/prisma.client.js";
import { metaChallengeQuerySchema } from "../schemas/index.js";

function globalMetaVerifyToken(): string {
  return env.META_WEBHOOK_VERIFY_TOKEN;
}

async function getInboxVerifyToken(inboxId: string): Promise<string | null> {
  const settings = await prisma.inboxSettings.findUnique({ where: { inboxId } });
  return settings?.webhookVerifyToken ?? null;
}

function logMetaWebhookResult(
  request: { log: FastifyInstance["log"] },
  inboxId: string | undefined,
  result: Awaited<ReturnType<typeof processMetaWebhookPayload>>
) {
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

  request.log.info(
    { inboxId: inboxId ?? "global", processed: result.processed, events: result.events },
    "Meta webhook procesado"
  );
}

function scheduleMetaWebhookProcessing(
  request: { log: FastifyInstance["log"]; body: unknown },
  inboxId?: string
): void {
  void processMetaWebhookPayload(request.body as never, inboxId)
    .then((result) => logMetaWebhookResult(request, inboxId, result))
    .catch((error) => {
      request.log.error(
        { inboxId: inboxId ?? "global", err: error },
        "Meta webhook processing failed"
      );
    });
}

export async function webhookRoutes(app: FastifyInstance) {
  app.get("/webhooks/meta", async (request, reply) => {
    const query = metaChallengeQuerySchema.parse(request.query);
    const challenge = verifyMetaChallenge({
      mode: query["hub.mode"],
      verifyToken: query["hub.verify_token"],
      challenge: query["hub.challenge"],
      expectedToken: globalMetaVerifyToken(),
    });

    if (!challenge) {
      return reply.status(403).send({ message: "Verificación de webhook fallida" });
    }

    return reply.status(200).send(challenge);
  });

  app.post("/webhooks/meta", async (request, reply) => {
    request.log.info({ inboxId: "global" }, "Meta webhook POST recibido");
    scheduleMetaWebhookProcessing(request);
    return reply.send({ success: true, accepted: true });
  });

  app.get("/webhooks/meta/:inboxId", async (request, reply) => {
    const { inboxId } = request.params as { inboxId: string };
    const query = metaChallengeQuerySchema.parse(request.query);
    const settings = await resolveInboxForMetaWebhook(inboxId);

    const challenge = verifyMetaChallenge({
      mode: query["hub.mode"],
      verifyToken: query["hub.verify_token"],
      challenge: query["hub.challenge"],
      expectedToken: settings?.webhookVerifyToken ?? (await getInboxVerifyToken(inboxId)),
    });

    if (!challenge) {
      return reply.status(403).send({ message: "Verificación de webhook fallida" });
    }

    return reply.status(200).send(challenge);
  });

  app.post("/webhooks/meta/:inboxId", async (request, reply) => {
    const { inboxId } = request.params as { inboxId: string };
    request.log.info({ inboxId }, "Meta webhook POST recibido");
    scheduleMetaWebhookProcessing(request, inboxId);
    return reply.send({ success: true, accepted: true });
  });
}
