import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { fetchLinkPreview } from "../../../application/link-preview/link-preview.service.js";
import { AppError } from "../../../domain/errors.js";
import { authenticate } from "../plugins/error-handler.plugin.js";

const linkPreviewQuerySchema = z.object({
  url: z.string().min(1),
});

export async function linkPreviewRoutes(app: FastifyInstance) {
  app.get("/link-preview", { preHandler: authenticate }, async (request, reply) => {
    const parsed = linkPreviewQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError("URL requerida", 400, "INVALID_URL");
    }

    return reply.send(await fetchLinkPreview(parsed.data.url));
  });
}
