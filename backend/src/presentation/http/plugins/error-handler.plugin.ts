import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { assertActiveAgentSession } from "../../../application/auth/auth.service.js";
import {
  AppError,
  SessionExpiredError,
  UnauthorizedError,
} from "../../../domain/errors.js";
import { ApiError } from "../../../shared/api-error.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        message: error.message,
        code: error.code,
        ...error.details,
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

function isJwtExpiredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED";
}

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (error) {
    if (isJwtExpiredError(error)) {
      throw new SessionExpiredError(
        "Tu sesión expiró. Vuelve a iniciar sesión."
      );
    }
    throw new UnauthorizedError();
  }

  const payload = request.user as { sub: string; sid?: string };
  await assertActiveAgentSession(payload.sub, payload.sid);
}
