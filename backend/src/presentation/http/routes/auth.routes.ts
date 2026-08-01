import type { FastifyInstance } from "fastify";
import { env } from "../../../config/env.js";
import {
  clearAgentSession,
  getAgentById,
  loginAgent,
  rotateAgentSession,
} from "../../../application/auth/auth.service.js";
import { loginBodySchema } from "../schemas/index.js";
import { authenticate } from "../plugins/error-handler.plugin.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const agent = await loginAgent(body.username, body.password);
    const sessionId = await rotateAgentSession(agent.id);

    const accessToken = app.jwt.sign(
      { sub: agent.id, username: agent.username, sid: sessionId },
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return reply.send({ accessToken, agent });
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as { sub: string };
    const agent = await getAgentById(payload.sub);

    if (!agent) {
      return reply.status(401).send({ message: "Sesión inválida", code: "UNAUTHORIZED" });
    }

    return reply.send(agent);
  });

  app.post("/auth/logout", { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as { sub: string };
    await clearAgentSession(payload.sub);
    return reply.status(204).send();
  });
}
