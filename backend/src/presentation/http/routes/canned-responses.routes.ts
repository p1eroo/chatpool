import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createCannedResponse,
  deleteCannedResponse,
  listCannedResponses,
  resolveCannedAttachment,
  updateCannedResponse,
} from "../../../application/canned-responses/canned-responses.service.js";
import {
  attachmentResponseHeaders,
} from "../../../application/media/message-attachment.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";
import { requirePermission } from "../plugins/require-permission.plugin.js";

async function parseCannedMultipart(request: {
  parts: () => AsyncIterableIterator<{
    type: string;
    fieldname: string;
    value?: unknown;
    filename?: string;
    mimetype?: string;
    toBuffer?: () => Promise<Buffer>;
  }>;
}) {
  let inboxId = "";
  let title = "";
  let content = "";
  let removeImage = false;
  let file: { buffer: Buffer; originalName: string; mimeType: string } | undefined;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (part.fieldname === "file" && part.toBuffer) {
        const buffer = await part.toBuffer();
        file = {
          buffer,
          originalName: part.filename || "imagen.jpg",
          mimeType: part.mimetype || "application/octet-stream",
        };
      }
      continue;
    }

    const value = String(part.value ?? "");
    if (part.fieldname === "inboxId") inboxId = value;
    if (part.fieldname === "title") title = value;
    if (part.fieldname === "content") content = value;
    if (part.fieldname === "removeImage") removeImage = value === "true";
  }

  return { inboxId, title, content, removeImage, file };
}

export async function cannedResponsesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/canned-responses", async (request, reply) => {
    const query = z.object({ inboxId: z.string().min(1) }).parse(request.query);
    const user = request.user as { sub: string };

    return reply.send(
      await listCannedResponses({
        inboxId: query.inboxId,
        agentId: user.sub,
      })
    );
  });

  app.get("/canned-responses/:id/attachment", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };
    const query = request.query as { inline?: string };
    const disposition = query.inline === "1" ? "inline" : "attachment";

    const attachment = await resolveCannedAttachment(user.sub, id);
    const headers = attachmentResponseHeaders(
      attachment.fileName,
      attachment.mimeType,
      disposition
    );
    return reply.status(200).headers(headers).send(attachment.buffer);
  });

  app.post(
    "/canned-responses",
    { preHandler: requirePermission("manageCannedResponses") },
    async (request, reply) => {
      const user = request.user as { sub: string };

      if (request.isMultipart()) {
        const parsed = await parseCannedMultipart(request);
        const inboxId = parsed.inboxId.trim();
        const title = parsed.title.trim();
        if (!inboxId || !title) {
          return reply.status(400).send({ message: "Bandeja y título son obligatorios" });
        }
        return reply.status(201).send(
          await createCannedResponse(user.sub, {
            inboxId,
            title,
            content: parsed.content,
            file: parsed.file,
          })
        );
      }

      const body = z
        .object({
          inboxId: z.string().min(1),
          title: z.string().min(1),
          content: z.string().optional().default(""),
        })
        .parse(request.body);

      return reply.status(201).send(
        await createCannedResponse(user.sub, {
          inboxId: body.inboxId,
          title: body.title,
          content: body.content,
        })
      );
    }
  );

  app.patch(
    "/canned-responses/:id",
    { preHandler: requirePermission("manageCannedResponses") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { sub: string };

      if (request.isMultipart()) {
        const parsed = await parseCannedMultipart(request);
        return reply.send(
          await updateCannedResponse(user.sub, id, {
            title: parsed.title || undefined,
            content: parsed.content,
            removeImage: parsed.removeImage,
            file: parsed.file,
          })
        );
      }

      const body = z
        .object({
          title: z.string().min(1).optional(),
          content: z.string().optional(),
          removeImage: z.boolean().optional(),
        })
        .parse(request.body);

      return reply.send(await updateCannedResponse(user.sub, id, body));
    }
  );

  app.delete(
    "/canned-responses/:id",
    { preHandler: requirePermission("manageCannedResponses") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { sub: string };
      await deleteCannedResponse(user.sub, id);
      return reply.status(204).send();
    }
  );
}
