import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from "../../../application/roles/roles.service.js";
import { PERMISSION_KEYS } from "../../../shared/permissions.js";
import { authenticate } from "../plugins/error-handler.plugin.js";
import { requirePermission } from "../plugins/require-permission.plugin.js";

const permissionsSchema = z
  .object(
    Object.fromEntries(PERMISSION_KEYS.map((key) => [key, z.boolean().optional()])) as Record<
      (typeof PERMISSION_KEYS)[number],
      z.ZodOptional<z.ZodBoolean>
    >
  )
  .partial();

const createRoleSchema = z.object({
  name: z.string().min(1),
  permissions: permissionsSchema.optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  permissions: permissionsSchema.optional(),
});

export async function rolesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/roles", async (_request, reply) => {
    return reply.send(await listRoles());
  });

  app.post("/roles", { preHandler: requirePermission("manageAgents") }, async (request, reply) => {
    const body = createRoleSchema.parse(request.body);
    return reply.status(201).send(await createRole(body));
  });

  app.patch(
    "/roles/:id",
    { preHandler: requirePermission("manageAgents") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateRoleSchema.parse(request.body);
      return reply.send(await updateRole(id, body));
    }
  );

  app.delete(
    "/roles/:id",
    { preHandler: requirePermission("manageAgents") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await deleteRole(id);
      return reply.status(204).send();
    }
  );
}
