import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  deleteConversation,
  deleteMessage,
  getConversationMessages,
  listConversations,
  markConversationRead,
  sendAgentMessage,
  sendAgentMessageWithFile,
  sendWhatsAppTemplate,
  toggleConversationLabel,
  updateConversation,
} from "../../../application/conversations/conversations.service.js";
import {
  attachmentResponseHeaders,
  resolveMessageAttachment,
} from "../../../application/media/message-attachment.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";

const sendMessageSchema = z.object({
  content: z.string().min(1),
  isPrivate: z.boolean().optional(),
  contentType: z.enum(["text", "image", "file", "audio"]).optional(),
  replyToMessageId: z.string().optional(),
});

const sendTemplateSchema = z.object({
  templateId: z.string().min(1),
  templateName: z.string().min(1),
  content: z.string().min(1),
});

const updateConversationSchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
  assigneeId: z.string().nullable().optional(),
  unreadCount: z.number().int().min(0).optional(),
});

const attachmentContentTypeSchema = z.enum(["image", "file", "audio"]);

export async function conversationsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/conversations", async (request, reply) => {
    const query = request.query as {
      inboxId?: string;
      status?: string;
      assignee?: "mine" | "unassigned" | "all";
      labelId?: string;
    };
    const user = request.user as { sub: string };

    return reply.send(
      await listConversations({
        inboxId: query.inboxId,
        status: query.status,
        assignee: query.assignee,
        agentId: user.sub,
        labelId: query.labelId,
      })
    );
  });

  app.get("/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(await getConversationMessages(id));
  });

  app.get("/conversations/:conversationId/messages/:messageId/attachment", async (request, reply) => {
    const { conversationId, messageId } = request.params as {
      conversationId: string;
      messageId: string;
    };
    const query = request.query as { inline?: string };
    const disposition = query.inline === "1" ? "inline" : "attachment";

    const attachment = await resolveMessageAttachment(conversationId, messageId);
    const headers = attachmentResponseHeaders(
      attachment.fileName,
      attachment.mimeType,
      disposition
    );

    return reply.status(200).headers(headers).send(attachment.buffer);
  });

  app.post("/conversations/:id/read", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };
    const readReason = request.headers["x-chatpool-read-reason"] ?? "unknown";
    const context = await markConversationRead(id);

    request.log.info(
      {
        ...context,
        agentId: user.sub,
        readReason,
      },
      `Conversación marcada como leída: ${context.contactName} (${context.inboxName}) [${readReason}]`
    );

    return reply.status(204).send();
  });

  app.post("/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };

    if (request.isMultipart()) {
      let content = "";
      let isPrivate = false;
      let contentType: "image" | "file" | "audio" = "file";
      let replyToMessageId: string | undefined;
      let fileBuffer: Buffer | null = null;
      let fileName = "archivo";
      let mimeType = "application/octet-stream";

      for await (const part of request.parts()) {
        if (part.type === "file") {
          fileBuffer = await part.toBuffer();
          fileName = part.filename || fileName;
          mimeType = part.mimetype || mimeType;
          continue;
        }

        const value = part.value?.toString() ?? "";
        if (part.fieldname === "content") content = value;
        if (part.fieldname === "isPrivate") isPrivate = value === "true";
        if (part.fieldname === "replyToMessageId") replyToMessageId = value || undefined;
        if (part.fieldname === "contentType") {
          contentType = attachmentContentTypeSchema.parse(value);
        }
      }

      if (!fileBuffer) {
        return reply.status(400).send({ message: "Archivo requerido" });
      }

      return reply.status(201).send(
        await sendAgentMessageWithFile(id, user.sub, {
          content: content.trim() || fileName,
          isPrivate,
          contentType,
          buffer: fileBuffer,
          originalName: fileName,
          mimeType,
          replyToMessageId,
        })
      );
    }

    const body = sendMessageSchema.parse(request.body);
    return reply.status(201).send(await sendAgentMessage(id, user.sub, body));
  });

  app.post("/conversations/:id/templates", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };
    const body = sendTemplateSchema.parse(request.body);
    return reply.status(201).send(await sendWhatsAppTemplate(id, user.sub, body));
  });

  app.patch("/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };
    const body = updateConversationSchema.parse(request.body);
    return reply.send(await updateConversation(id, body, user.sub));
  });

  app.post("/conversations/:id/labels/:labelId/toggle", async (request, reply) => {
    const { id, labelId } = request.params as { id: string; labelId: string };
    const user = request.user as { sub: string };
    return reply.send(await toggleConversationLabel(id, labelId, user.sub));
  });

  app.delete("/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteConversation(id);
    return reply.status(204).send();
  });

  app.delete("/conversations/:conversationId/messages/:messageId", async (request, reply) => {
    const { conversationId, messageId } = request.params as {
      conversationId: string;
      messageId: string;
    };
    await deleteMessage(conversationId, messageId);
    return reply.status(204).send();
  });
}
