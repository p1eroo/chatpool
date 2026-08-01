import type { FastifyInstance } from "fastify";
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

    try {
      app.jwt.verify(token);
    } catch {
      socket.close(4401, "Token inválido");
      return;
    }

    const client = {
      send: (data: string) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(data);
        }
      },
    };

    registerRealtimeClient(client);

    socket.on("close", () => {
      unregisterRealtimeClient(client);
    });

    socket.on("error", () => {
      unregisterRealtimeClient(client);
    });

    socket.send(JSON.stringify({ type: "connected" }));
  });
}
