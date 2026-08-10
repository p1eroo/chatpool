import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import { env } from "../../config/env.js";
import { registerErrorHandler } from "./plugins/error-handler.plugin.js";
import { authRoutes } from "./routes/auth.routes.js";
import { agentsRoutes } from "./routes/agents.routes.js";
import { inboxesRoutes } from "./routes/inboxes.routes.js";
import { conversationsRoutes } from "./routes/conversations.routes.js";
import { contactsRoutes } from "./routes/contacts.routes.js";
import { cannedResponsesRoutes } from "./routes/canned-responses.routes.js";
import { integrationRoutes } from "./routes/integrations.routes.js";
import { outgoingWebhooksRoutes } from "./routes/outgoing-webhooks.routes.js";
import { rolesRoutes } from "./routes/roles.routes.js";
import { webhookRoutes } from "./routes/webhooks.routes.js";
import { realtimeRoutes } from "./routes/realtime.routes.js";
import { linkPreviewRoutes } from "./routes/link-preview.routes.js";
import { applicationApiRoutes } from "./routes/application-api.routes.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; username: string; sid: string };
    user: { sub: string; username: string; sid: string };
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "development",
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((item) => item.trim()),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Chatpool-Read-Reason"],
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  await app.register(websocket);

  await app.register(multipart, {
    limits: {
      fileSize: env.FILES_MAX_MB * 1024 * 1024,
      files: 1,
    },
  });

  registerErrorHandler(app);

  app.get("/", async () => ({ status: "ok", service: "Chatpool API" }));
  app.get("/health", async () => ({ status: "ok", service: "chatpool-api" }));

  await app.register(authRoutes);
  await app.register(agentsRoutes);
  await app.register(rolesRoutes);
  await app.register(inboxesRoutes);
  await app.register(conversationsRoutes);
  await app.register(contactsRoutes);
  await app.register(cannedResponsesRoutes);
  await app.register(integrationRoutes);
  await app.register(outgoingWebhooksRoutes);
  await app.register(webhookRoutes);
  await app.register(realtimeRoutes);
  await app.register(linkPreviewRoutes);
  await app.register(applicationApiRoutes);

  return app;
}
