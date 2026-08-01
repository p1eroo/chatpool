import type { FastifyInstance } from "fastify";
import { listContacts } from "../../../application/contacts/contacts.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";

export async function contactsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/contacts", async (request, reply) => {
    const query = request.query as { inboxId?: string };

    return reply.send(
      await listContacts({
        inboxId: query.inboxId,
      })
    );
  });
}
