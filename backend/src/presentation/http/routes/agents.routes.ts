import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createAgent,
  deleteAgent,
  listAgents,
  updateAgent,
} from "../../../application/agents/agents.service.js";
import { ForbiddenError } from "../../../domain/errors.js";
import { getPermissionsForAgent } from "../../../application/permissions/permissions.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";
import { requirePermission } from "../plugins/require-permission.plugin.js";

const createAgentSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(8),
  roleId: z.string().min(1),
  phone: z.string().optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  roleId: z.string().min(1).optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
  status: z.enum(["online", "away", "busy", "offline"]).optional(),
  inboxIds: z.array(z.string().min(1)).optional(),
});

export async function agentsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Lectura: cualquier agente autenticado (asignaciones, listados).
  app.get("/agents", async (_request, reply) => {
    return reply.send(await listAgents());
  });

  app.post("/agents", { preHandler: requirePermission("manageAgents") }, async (request, reply) => {
    const body = createAgentSchema.parse(request.body);
    return reply.status(201).send(await createAgent(body));
  });

  app.patch("/agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };
    const body = updateAgentSchema.parse(request.body);
    const isSelf = id === user.sub;
    const canManageAgents = (await getPermissionsForAgent(user.sub)).manageAgents;

    if (!isSelf && !canManageAgents) {
      throw new ForbiddenError();
    }
    if (
      isSelf &&
      !canManageAgents &&
      (body.roleId !== undefined ||
        body.active !== undefined ||
        body.username !== undefined ||
        body.inboxIds !== undefined)
    ) {
      throw new ForbiddenError();
    }

    if (body.inboxIds !== undefined && !canManageAgents) {
      throw new ForbiddenError();
    }

    const patch =
      isSelf && !canManageAgents
        ? {
            name: body.name,
            phone: body.phone,
            password: body.password,
            status: body.status,
          }
        : body;

    return reply.send(await updateAgent(id, patch));
  });

  app.delete(
    "/agents/:id",
    { preHandler: requirePermission("manageAgents") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await deleteAgent(id);
      return reply.status(204).send();
    }
  );
}
