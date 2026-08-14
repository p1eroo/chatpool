import type { FastifyInstance } from "fastify";
import { assertActiveAgentSession } from "../../../application/auth/auth.service.js";
import {
  clearTypingOnDisconnect,
  handleIncomingTypingMessage,
  type AgentTypingClient,
} from "../../../application/realtime/agent-typing.service.js";
import { SessionRevokedError, UnauthorizedError } from "../../../domain/errors.js";
import {
  registerRealtimeClient,
  unregisterRealtimeClient,
} from "../../../infrastructure/realtime/realtime-hub.js";

export async function realtimeRoutes(app: FastifyInstance) {
  app.get("/realtime", { websocket: true }, (socket, request) => {
    const token =
      typeof request.query === "object" && request.query !== null
        ? (request.query as { token?: string }).token
        : undefined;

    if (!token) {
      socket.close(4401, "Token requerido");
      return;
    }

    let payload: { sub: string; sid?: string };
    try {
      payload = app.jwt.verify(token) as { sub: string; sid?: string };
    } catch {
      socket.close(4401, "Token inválido");
      return;
    }

    void assertActiveAgentSession(payload.sub, payload.sid)
      .then(() => {
        const client: AgentTypingClient = {
          send: (data: string) => {
            if (socket.readyState === socket.OPEN) {
              socket.send(data);
            }
          },
          agentId: payload.sub,
          agentName: null,
          allowedConversations: new Map(),
          typingConversationIds: new Set(),
          lastTypingTrueAt: new Map(),
        };

        registerRealtimeClient(client);

        socket.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
          void handleIncomingTypingMessage(client, raw).catch(() => {
            // Ignorar payloads inválidos o errores transitorios de acceso.
          });
        });

        socket.on("close", () => {
          clearTypingOnDisconnect(client);
          unregisterRealtimeClient(client);
        });

        socket.on("error", () => {
          clearTypingOnDisconnect(client);
          unregisterRealtimeClient(client);
        });

        socket.send(JSON.stringify({ type: "connected" }));
      })
      .catch((error) => {
        if (error instanceof SessionRevokedError || error instanceof UnauthorizedError) {
          socket.close(4401, "Sesión cerrada");
          return;
        }
        socket.close(4500, "Error de sesión");
      });
  });
}
