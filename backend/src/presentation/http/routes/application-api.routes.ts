import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { resolveApiActorAgentId } from "../../../application/api/api-agent.service.js";
import {
  listConversationLabelNames,
  setConversationLabelsByNames,
} from "../../../application/api/conversation-labels-api.service.js";
import { listAgents } from "../../../application/agents/agents.service.js";
import { getContactById, listContacts } from "../../../application/contacts/contacts.service.js";
import {
  getConversationById,
  getConversationMessages,
  listConversations,
  sendAgentMessage,
  sendRequestContactInfo,
  sendWhatsAppTemplate,
  setConversationBotStatus,
  updateConversation,
} from "../../../application/conversations/conversations.service.js";
import { startOutboundConversation } from "../../../application/conversations/start-outbound.service.js";
import { getInboxById } from "../../../application/inboxes/inboxes.service.js";
import { listLabelsForInbox } from "../../../application/labels/labels.service.js";
import { AppError, NotFoundError } from "../../../domain/errors.js";
import { prisma } from "../../../infrastructure/database/prisma.client.js";
import {
  assertBotNotPaused,
  BOT_PAUSE_MINUTES_MAX,
  BOT_PAUSE_MINUTES_MIN,
} from "../../../shared/bot-pause.js";

/** Propósitos que pueden enviarse aunque el bot esté pausado (OTP / verificación). */
const BOT_PAUSE_BYPASS_PURPOSES = ["otp", "authentication"] as const;

const createMessageSchema = z
  .object({
    content: z.string().min(1),
    private: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
    message_type: z.enum(["outgoing", "incoming"]).optional(),
    /**
     * Propósito del mensaje. `otp` / `authentication` omiten el bloqueo BOT_PAUSED
     * (códigos de verificación que deben llegar aunque un operador haya pausado el bot).
     */
    purpose: z.enum(BOT_PAUSE_BYPASS_PURPOSES).optional(),
    reply_to_message_id: z.string().optional(),
    replyToMessageId: z.string().optional(),
    client_message_id: z.string().min(1).max(128).optional(),
    clientMessageId: z.string().min(1).max(128).optional(),
    template_params: z
      .object({
        name: z.string().min(1),
        language: z.string().min(1),
        category: z.string().optional(),
        processed_params: z
          .object({
            body: z.record(z.string()).optional(),
            header: z.record(z.string()).optional(),
            buttons: z
              .array(
                z.object({
                  type: z.enum(["url", "copy_code"]).optional(),
                  parameter: z.string().optional(),
                  index: z.number().int().min(0).optional(),
                  text: z.string().optional(),
                })
              )
              .optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .superRefine((body, ctx) => {
    if (body.message_type === "incoming") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Solo se admiten mensajes outgoing desde la Application API",
        path: ["message_type"],
      });
    }
  });

function shouldBypassBotPause(
  purpose: (typeof BOT_PAUSE_BYPASS_PURPOSES)[number] | undefined
): boolean {
  return purpose != null;
}

const labelsBodySchema = z.object({
  labels: z.array(z.string()),
});

const toggleStatusSchema = z.object({
  status: z.enum(["open", "resolved", "pending", "snoozed"]),
});

const toggleBotSchema = z.object({
  status: z.enum(["on", "off"]),
  minutes: z
    .number()
    .int()
    .min(BOT_PAUSE_MINUTES_MIN)
    .max(BOT_PAUSE_MINUTES_MAX)
    .optional(),
});

const requestContactInfoSchema = z.object({
  content: z.string().max(1024).optional(),
  client_message_id: z.string().min(1).max(128).optional(),
  clientMessageId: z.string().min(1).max(128).optional(),
});

const assignmentSchema = z.object({
  assignee_id: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  team_id: z.union([z.string(), z.number()]).optional(),
});

const createConversationSchema = z.object({
  inbox_id: z.string().min(1).optional(),
  inboxId: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  source_id: z.string().min(1).optional(),
  name: z.string().optional(),
});

type InboxParams = { inboxId: string };

function getPathInboxId(request: FastifyRequest): string {
  const { inboxId } = request.params as InboxParams;
  return inboxId;
}

async function assertInboxExists(inboxId: string) {
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: { id: true },
  });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");
  return inbox.id;
}

async function assertConversationInInbox(conversationId: string, inboxId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, inboxId: true, botPausedUntil: true },
  });
  if (!conversation || conversation.inboxId !== inboxId) {
    throw new NotFoundError("Conversación no encontrada");
  }
  return conversation;
}

async function assertContactInInbox(contactId: string, inboxId: string) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, inboxId: true },
  });
  if (!contact || contact.inboxId !== inboxId) {
    throw new NotFoundError("Contacto no encontrado");
  }
  return contact;
}

function orderedParamsFromRecord(record?: Record<string, string>): string[] | undefined {
  if (!record) return undefined;
  const entries = Object.entries(record).sort(([a], [b]) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  return entries.map(([, value]) => value);
}

export async function applicationApiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request) => {
    const { inboxId } = request.params as { inboxId?: string };
    if (inboxId == null) return;
    await assertInboxExists(inboxId);
  });

  app.get("/api/v1/inboxes/:inboxId/profile", async (_request, reply) => {
    const agentId = await resolveApiActorAgentId();
    const agents = await listAgents();
    const agent = agents.find((item) => item.id === agentId);
    return reply.send({
      id: agent?.id ?? agentId,
      name: agent?.name ?? "API",
      available_name: agent?.name ?? "API",
      email: agent?.email,
      role: agent?.roleId === "role-admin" ? "administrator" : "agent",
      type: "user",
    });
  });

  app.get("/api/v1/inboxes/:inboxId", async (request, reply) => {
    const inboxId = getPathInboxId(request);
    const { inbox } = await getInboxById(inboxId);
    return reply.send(inbox);
  });

  app.get("/api/v1/inboxes/:inboxId/labels", async (request, reply) => {
    const inboxId = getPathInboxId(request);
    const payload = await listLabelsForInbox(inboxId);
    return reply.send({ payload });
  });

  app.get("/api/v1/inboxes/:inboxId/agents", async (_request, reply) => {
    const payload = await listAgents();
    return reply.send(payload);
  });

  app.get("/api/v1/inboxes/:inboxId/contacts", async (request, reply) => {
    const inboxId = getPathInboxId(request);
    const payload = await listContacts({ inboxId });
    return reply.send({ payload });
  });

  app.get("/api/v1/inboxes/:inboxId/contacts/:id", async (request, reply) => {
    const inboxId = getPathInboxId(request);
    const { id } = request.params as { id: string };
    await assertContactInInbox(id, inboxId);
    return reply.send(await getContactById(id));
  });

  app.get("/api/v1/inboxes/:inboxId/conversations", async (request, reply) => {
    const inboxId = getPathInboxId(request);
    const query = request.query as {
      status?: string;
      assignee_type?: "me" | "unassigned" | "all";
      label_id?: string;
      labelId?: string;
    };

    const assignee =
      query.assignee_type === "me"
        ? "mine"
        : query.assignee_type === "unassigned"
          ? "unassigned"
          : "all";

    const agentId = await resolveApiActorAgentId();
    const data = await listConversations({
      inboxId,
      status: query.status,
      assignee,
      agentId: query.assignee_type === "me" ? agentId : undefined,
      labelId: query.label_id ?? query.labelId,
    });

    return reply.send({
      data: {
        meta: { all_count: data.length },
        payload: data,
      },
    });
  });

  app.post("/api/v1/inboxes/:inboxId/conversations", async (request, reply) => {
    const inboxId = getPathInboxId(request);
    const body = createConversationSchema.parse(request.body ?? {});
    const bodyInboxId = body.inbox_id ?? body.inboxId;
    if (bodyInboxId && bodyInboxId !== inboxId) {
      throw new AppError(
        "inbox_id del body debe coincidir con el inboxId del path",
        400,
        "INVALID_CREATE_CONVERSATION"
      );
    }

    const phone = body.phone ?? body.source_id;
    if (!phone) {
      throw new AppError(
        "phone (o source_id) es obligatorio",
        400,
        "INVALID_CREATE_CONVERSATION"
      );
    }

    const agentId = await resolveApiActorAgentId();
    const conversation = await startOutboundConversation({
      agentId,
      inboxId,
      phone,
      name: body.name,
    });

    return reply.status(200).send(conversation);
  });

  app.get("/api/v1/inboxes/:inboxId/conversations/:id", async (request, reply) => {
    const inboxId = getPathInboxId(request);
    const { id } = request.params as { id: string };
    await assertConversationInInbox(id, inboxId);
    return reply.send(await getConversationById(id));
  });

  app.get(
    "/api/v1/inboxes/:inboxId/conversations/:id/messages",
    async (request, reply) => {
      const inboxId = getPathInboxId(request);
      const { id } = request.params as { id: string };
      await assertConversationInInbox(id, inboxId);
      const payload = await getConversationMessages(id);
      return reply.send({ payload });
    }
  );

  app.post(
    "/api/v1/inboxes/:inboxId/conversations/:id/messages",
    async (request, reply) => {
      const inboxId = getPathInboxId(request);
      const { id } = request.params as { id: string };
      const body = createMessageSchema.parse(request.body ?? {});
      const agentId = await resolveApiActorAgentId();

      const conversation = await assertConversationInInbox(id, inboxId);
      if (!shouldBypassBotPause(body.purpose)) {
        assertBotNotPaused(conversation.botPausedUntil);
      }

      if (body.template_params) {
        const template = body.template_params;
        const bodyParameters = orderedParamsFromRecord(template.processed_params?.body);
        const headerParameters = orderedParamsFromRecord(template.processed_params?.header);
        const buttonUrlParameters = template.processed_params?.buttons
          ?.map((button, index) => {
            if (button.type && button.type !== "url") return null;
            const text = button.parameter ?? button.text;
            if (!text) return null;
            return { index: button.index ?? index, text };
          })
          .filter((item): item is { index: number; text: string } => Boolean(item));

        const message = await sendWhatsAppTemplate(
          id,
          agentId,
          {
            templateName: template.name,
            language: template.language,
            content: body.content,
            bodyParameters,
            headerParameters,
            buttonUrlParameters: buttonUrlParameters?.length
              ? buttonUrlParameters
              : undefined,
            clientMessageId: body.client_message_id ?? body.clientMessageId,
          },
          { senderType: "bot" }
        );

        return reply.status(200).send(message);
      }

      const message = await sendAgentMessage(
        id,
        agentId,
        {
          content: body.content,
          isPrivate: body.private ?? body.isPrivate,
          replyToMessageId: body.reply_to_message_id ?? body.replyToMessageId,
          clientMessageId: body.client_message_id ?? body.clientMessageId,
        },
        { senderType: "bot" }
      );

      return reply.status(200).send(message);
    }
  );

  app.post(
    "/api/v1/inboxes/:inboxId/conversations/:id/request-contact-info",
    async (request, reply) => {
      const inboxId = getPathInboxId(request);
      const { id } = request.params as { id: string };
      const body = requestContactInfoSchema.parse(request.body ?? {});
      const agentId = await resolveApiActorAgentId();

      const conversation = await assertConversationInInbox(id, inboxId);
      assertBotNotPaused(conversation.botPausedUntil);

      const message = await sendRequestContactInfo(
        id,
        agentId,
        {
          content: body.content,
          clientMessageId: body.client_message_id ?? body.clientMessageId,
        },
        { senderType: "bot" }
      );

      return reply.status(200).send(message);
    }
  );

  app.get(
    "/api/v1/inboxes/:inboxId/conversations/:id/labels",
    async (request, reply) => {
      const inboxId = getPathInboxId(request);
      const { id } = request.params as { id: string };
      await assertConversationInInbox(id, inboxId);
      const payload = await listConversationLabelNames(id);
      return reply.send({ payload });
    }
  );

  app.post(
    "/api/v1/inboxes/:inboxId/conversations/:id/labels",
    async (request, reply) => {
      const inboxId = getPathInboxId(request);
      const { id } = request.params as { id: string };
      await assertConversationInInbox(id, inboxId);
      const body = labelsBodySchema.parse(request.body ?? {});
      const agentId = await resolveApiActorAgentId();
      const result = await setConversationLabelsByNames({
        conversationId: id,
        labelNames: body.labels,
        actorAgentId: agentId,
      });
      return reply.send({ payload: result.payload });
    }
  );

  app.post(
    "/api/v1/inboxes/:inboxId/conversations/:id/toggle_status",
    async (request, reply) => {
      const inboxId = getPathInboxId(request);
      const { id } = request.params as { id: string };
      await assertConversationInInbox(id, inboxId);
      const body = toggleStatusSchema.parse(request.body ?? {});

      if (body.status === "pending" || body.status === "snoozed") {
        throw new AppError(
          `El estado "${body.status}" no está soportado. Usa open o resolved.`,
          422,
          "STATUS_UNSUPPORTED"
        );
      }

      const agentId = await resolveApiActorAgentId();
      const conversation = await updateConversation(id, { status: body.status }, agentId);

      return reply.send({
        meta: {},
        payload: {
          success: true,
          current_status: conversation.status,
          conversation_id: conversation.id,
        },
      });
    }
  );

  app.post(
    "/api/v1/inboxes/:inboxId/conversations/:id/assignments",
    async (request, reply) => {
      const inboxId = getPathInboxId(request);
      const { id } = request.params as { id: string };
      await assertConversationInInbox(id, inboxId);
      const body = assignmentSchema.parse(request.body ?? {});
      const assigneeId = body.assignee_id ?? body.assigneeId;

      if (assigneeId === undefined) {
        throw new AppError(
          "assignee_id es obligatorio (usa null para desasignar). team_id no está soportado.",
          400,
          "INVALID_ASSIGNMENT"
        );
      }

      const agentId = await resolveApiActorAgentId();
      const conversation = await updateConversation(
        id,
        { assigneeId: assigneeId === null ? null : String(assigneeId) },
        agentId
      );

      return reply.send(conversation.assignee ?? { id: null });
    }
  );

  app.post(
    "/api/v1/inboxes/:inboxId/conversations/:id/toggle_bot",
    async (request, reply) => {
      const inboxId = getPathInboxId(request);
      const { id } = request.params as { id: string };
      await assertConversationInInbox(id, inboxId);
      const body = toggleBotSchema.parse(request.body ?? {});
      const result = await setConversationBotStatus(id, {
        status: body.status,
        minutes: body.minutes,
      });

      return reply.send({
        meta: {},
        payload: {
          success: true,
          bot_status: result.botStatus,
          bot_paused_until: result.botPausedUntil,
          conversation_id: result.conversationId,
        },
      });
    }
  );
}
