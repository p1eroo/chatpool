import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { validateAgentSession } from "../../../application/auth/auth.service.js";
import { AppError, SessionRevokedError, UnauthorizedError } from "../../../domain/errors.js";
import { ApiError } from "../../../shared/api-error.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        message: error.message,
        code: error.code,
      });
    }

    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        message: error.message,
        code: error.code,
      });
    }

    app.log.error(error);
    return reply.status(500).send({ message: "Error interno del servidor" });
  });
}

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError();
  }

  const payload = request.user as { sub: string; sid?: string };
  const valid = await validateAgentSession(payload.sub, payload.sid);

  if (!valid) {
    throw new SessionRevokedError();
  }
}
