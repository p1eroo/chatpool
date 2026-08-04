import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createCannedResponse,
  deleteCannedResponse,
  listCannedResponses,
  updateCannedResponse,
} from "../../../application/canned-responses/canned-responses.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";
import { requirePermission } from "../plugins/require-permission.plugin.js";

const upsertSchema = z.object({
  inboxId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

export async function cannedResponsesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/canned-responses", async (request, reply) => {
    const query = z.object({ inboxId: z.string().min(1) }).parse(request.query);
    const user = request.user as { sub: string };

    return reply.send(
      await listCannedResponses({
        inboxId: query.inboxId,
        agentId: user.sub,
      })
    );
  });

  app.post(
    "/canned-responses",
    { preHandler: requirePermission("manageCannedResponses") },
    async (request, reply) => {
      const body = upsertSchema.parse(request.body);
      const user = request.user as { sub: string };
      return reply.status(201).send(await createCannedResponse(user.sub, body));
    }
  );

  app.patch(
    "/canned-responses/:id",
    { preHandler: requirePermission("manageCannedResponses") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = patchSchema.parse(request.body);
      const user = request.user as { sub: string };
      return reply.send(await updateCannedResponse(user.sub, id, body));
    }
  );

  app.delete(
    "/canned-responses/:id",
    { preHandler: requirePermission("manageCannedResponses") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { sub: string };
      await deleteCannedResponse(user.sub, id);
      return reply.status(204).send();
    }
  );
}
