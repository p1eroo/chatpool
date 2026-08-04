import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  deleteContact,
  listContacts,
  updateContact,
} from "../../../application/contacts/contacts.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";
import { requirePermission } from "../plugins/require-permission.plugin.js";

const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().optional(),
  city: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  isBlocked: z.boolean().optional(),
});

export async function contactsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/contacts", async (request, reply) => {
    const query = request.query as { inboxId?: string };
    const user = request.user as { sub: string };

    return reply.send(
      await listContacts({
        inboxId: query.inboxId,
        agentId: user.sub,
      })
    );
  });

  app.patch("/contacts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateContactSchema.parse(request.body);
    return reply.send(await updateContact(id, body));
  });

  app.delete(
    "/contacts/:id",
    { preHandler: requirePermission("deleteConversations") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await deleteContact(id);
      return reply.status(204).send();
    }
  );
}
