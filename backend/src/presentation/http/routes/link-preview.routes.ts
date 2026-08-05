import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { fetchLinkPreview } from "../../../application/link-preview/link-preview.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";

const linkPreviewQuerySchema = z.object({
  url: z.string().min(1),
});

export async function linkPreviewRoutes(app: FastifyInstance) {
  app.get("/link-preview", { preHandler: authenticate }, async (request, reply) => {
    const { url } = linkPreviewQuerySchema.parse(request.query);
    return reply.send(await fetchLinkPreview(url));
  });
}
