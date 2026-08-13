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
  sendRequestContactInfo,
  sendWhatsAppTemplate,
  toggleConversationLabel,
  updateConversation,
} from "../../../application/conversations/conversations.service.js";
import { retryFailedMessageDelivery } from "../../../application/conversations/message-delivery.service.js";
import { forwardMessages } from "../../../application/conversations/message-forward.service.js";
import { startOutboundConversation } from "../../../application/conversations/start-outbound.service.js";
import {
  attachmentResponseHeaders,
  resolveMessageAttachment,
} from "../../../application/media/message-attachment.service.js";
import {
  deleteSavedSticker,
  listSavedStickers,
  saveStickerFromMessage,
  sendSavedSticker,
} from "../../../application/stickers/saved-stickers.service.js";
import { authenticate } from "../plugins/error-handler.plugin.js";
import { requirePermission } from "../plugins/require-permission.plugin.js";
import { assertAgentPermission } from "../../../application/permissions/permissions.service.js";
import { assertAgentCanAccessConversation } from "../../../application/inboxes/inbox-access.service.js";

const sendMessageSchema = z.object({
  content: z.string().min(1),
  isPrivate: z.boolean().optional(),
  contentType: z.enum(["text", "image", "file", "audio", "sticker"]).optional(),
  replyToMessageId: z.string().optional(),
  clientMessageId: z.string().min(1).max(128).optional(),
  linkPreview: z
    .object({
      url: z.string().min(1),
      title: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      siteName: z.string().optional(),
    })
    .optional(),
  suppressLinkPreview: z.boolean().optional(),
});

const requestContactInfoSchema = z.object({
  content: z.string().max(1024).optional(),
  clientMessageId: z.string().min(1).max(128).optional(),
});

const sendTemplateSchema = z.object({
  templateId: z.string().optional(),
  templateName: z.string().min(1),
  language: z.string().min(1),
  content: z.string().optional(),
  bodyParameters: z.array(z.string()).optional(),
  headerParameters: z.array(z.string()).optional(),
  buttonUrlParameters: z
    .array(
      z.object({
        index: z.number().int().min(0),
        text: z.string().min(1),
      })
    )
    .optional(),
  clientMessageId: z.string().min(1).max(128).optional(),
});

const startOutboundSchema = z.object({
  inboxId: z.string().min(1),
  phone: z.string().min(1),
  name: z.string().optional(),
});

const updateConversationSchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
  assigneeId: z.string().nullable().optional(),
  unreadCount: z.number().int().min(0).optional(),
});

const attachmentContentTypeSchema = z.enum(["image", "file", "audio", "sticker"]);

const forwardMessagesSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1),
  targetConversationIds: z.array(z.string().min(1)).min(1),
  deliveries: z
    .array(
      z.object({
        sourceMessageId: z.string().min(1),
        targetConversationId: z.string().min(1),
        clientMessageId: z.string().min(1).max(128),
      })
    )
    .optional(),
});

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

  app.post(
    "/conversations/start",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const body = startOutboundSchema.parse(request.body);
      return reply.status(201).send(
        await startOutboundConversation({
          agentId: user.sub,
          inboxId: body.inboxId,
          phone: body.phone,
          name: body.name,
        })
      );
    }
  );

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

  app.post(
    "/conversations/:id/messages",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };

    if (request.isMultipart()) {
      let content = "";
      let isPrivate = false;
      let contentType: "image" | "file" | "audio" | "sticker" = "file";
      let replyToMessageId: string | undefined;
      let clientMessageId: string | undefined;
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
        if (part.fieldname === "clientMessageId") clientMessageId = value || undefined;
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
          clientMessageId,
        })
      );
    }

    const body = sendMessageSchema.parse(request.body);
    return reply.status(201).send(await sendAgentMessage(id, user.sub, body));
  });

  app.post(
    "/conversations/:id/request-contact-info",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { sub: string };
      const body = requestContactInfoSchema.parse(request.body ?? {});
      return reply.status(201).send(
        await sendRequestContactInfo(id, user.sub, {
          content: body.content,
          clientMessageId: body.clientMessageId,
        })
      );
    }
  );

  app.post(
    "/conversations/:id/templates",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { sub: string };
      const body = sendTemplateSchema.parse(request.body);
      return reply.status(201).send(await sendWhatsAppTemplate(id, user.sub, body));
    }
  );

  app.post(
    "/conversations/:id/messages/forward",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { sub: string };
      const body = forwardMessagesSchema.parse(request.body);
      return reply.status(200).send(
        await forwardMessages({
          agentId: user.sub,
          sourceConversationId: id,
          messageIds: body.messageIds,
          targetConversationIds: body.targetConversationIds,
          deliveries: body.deliveries,
        })
      );
    }
  );

  app.post(
    "/conversations/:conversationId/messages/:messageId/retry-delivery",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const { conversationId, messageId } = request.params as {
        conversationId: string;
        messageId: string;
      };
      const user = request.user as { sub: string };
      return reply.status(200).send(
        await retryFailedMessageDelivery({
          conversationId,
          messageId,
          agentId: user.sub,
        })
      );
    }
  );

  app.get(
    "/stickers",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const user = request.user as { sub: string };
      return reply.send(await listSavedStickers(user.sub));
    }
  );

  app.post(
    "/conversations/:id/messages/:messageId/save-sticker",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const { id, messageId } = request.params as { id: string; messageId: string };
      const user = request.user as { sub: string };
      return reply.status(201).send(
        await saveStickerFromMessage({
          agentId: user.sub,
          conversationId: id,
          messageId,
        })
      );
    }
  );

  app.post(
    "/conversations/:id/stickers/:stickerId/send",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const { id, stickerId } = request.params as { id: string; stickerId: string };
      const user = request.user as { sub: string };
      const body = z
        .object({
          replyToMessageId: z.string().optional(),
          clientMessageId: z.string().min(1).max(128).optional(),
        })
        .parse(request.body ?? {});
      return reply.status(201).send(
        await sendSavedSticker({
          agentId: user.sub,
          conversationId: id,
          stickerId,
          replyToMessageId: body.replyToMessageId,
          clientMessageId: body.clientMessageId,
        })
      );
    }
  );

  app.delete(
    "/stickers/:stickerId",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const { stickerId } = request.params as { stickerId: string };
      const user = request.user as { sub: string };
      await deleteSavedSticker(user.sub, stickerId);
      return reply.status(204).send();
    }
  );

  app.patch("/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };
    const body = updateConversationSchema.parse(request.body);

    await assertAgentCanAccessConversation(user.sub, id);

    if (body.status !== undefined) {
      await assertAgentPermission(user.sub, "resolveConversations");
    }
    if (body.assigneeId !== undefined) {
      await assertAgentPermission(user.sub, "assignConversations");
    }

    return reply.send(await updateConversation(id, body, user.sub));
  });

  app.post(
    "/conversations/:id/labels/:labelId/toggle",
    { preHandler: requirePermission("manageLabels") },
    async (request, reply) => {
      const { id, labelId } = request.params as { id: string; labelId: string };
      const user = request.user as { sub: string };
      return reply.send(await toggleConversationLabel(id, labelId, user.sub));
    }
  );

  app.delete(
    "/conversations/:id",
    { preHandler: requirePermission("deleteConversations") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await deleteConversation(id);
      return reply.status(204).send();
    }
  );

  app.delete(
    "/conversations/:conversationId/messages/:messageId",
    { preHandler: requirePermission("sendMessages") },
    async (request, reply) => {
      const { conversationId, messageId } = request.params as {
        conversationId: string;
        messageId: string;
      };
      await deleteMessage(conversationId, messageId);
      return reply.status(204).send();
    }
  );
}
