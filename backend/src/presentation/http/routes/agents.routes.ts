import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createAgent,
  deleteAgent,
  listAgents,
  updateAgent,
} from "../../../application/agents/agents.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";

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
});

export async function agentsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/agents", async (_request, reply) => {
    return reply.send(await listAgents());
  });

  app.post("/agents", async (request, reply) => {
    const body = createAgentSchema.parse(request.body);
    return reply.status(201).send(await createAgent(body));
  });

  app.patch("/agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateAgentSchema.parse(request.body);
    return reply.send(await updateAgent(id, body));
  });

  app.delete("/agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteAgent(id);
    return reply.status(204).send();
  });
}
