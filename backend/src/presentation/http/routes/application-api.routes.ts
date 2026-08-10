import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../../config/env.js";
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
  sendWhatsAppTemplate,
  updateConversation,
} from "../../../application/conversations/conversations.service.js";
import { startOutboundConversation } from "../../../application/conversations/start-outbound.service.js";
import { listInboxes } from "../../../application/inboxes/inboxes.service.js";
import { listAllLabels } from "../../../application/labels/labels.service.js";
import { AppError, NotFoundError } from "../../../domain/errors.js";

const createMessageSchema = z
  .object({
    content: z.string().min(1),
    private: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
    message_type: z.enum(["outgoing", "incoming"]).optional(),
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

const labelsBodySchema = z.object({
  labels: z.array(z.string()),
});

const toggleStatusSchema = z.object({
  status: z.enum(["open", "resolved", "pending", "snoozed"]),
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
    const { accountId } = request.params as { accountId?: string };
    if (accountId == null) return;
    if (accountId !== env.API_ACCOUNT_ID) {
      throw new NotFoundError("Cuenta no encontrada");
    }
  });

  app.get("/api/v1/accounts/:accountId/profile", async (_request, reply) => {
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

  app.get("/api/v1/accounts/:accountId/inboxes", async (_request, reply) => {
    const payload = await listInboxes();
    return reply.send({ payload });
  });

  app.get("/api/v1/accounts/:accountId/labels", async (_request, reply) => {
    const payload = await listAllLabels();
    return reply.send({ payload });
  });

  app.get("/api/v1/accounts/:accountId/agents", async (_request, reply) => {
    const payload = await listAgents();
    return reply.send(payload);
  });

  app.get("/api/v1/accounts/:accountId/contacts", async (request, reply) => {
    const query = request.query as { inbox_id?: string; inboxId?: string };
    const payload = await listContacts({
      inboxId: query.inbox_id ?? query.inboxId,
    });
    return reply.send({ payload });
  });

  app.get("/api/v1/accounts/:accountId/contacts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(await getContactById(id));
  });

  app.get("/api/v1/accounts/:accountId/conversations", async (request, reply) => {
    const query = request.query as {
      inbox_id?: string;
      inboxId?: string;
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
      inboxId: query.inbox_id ?? query.inboxId,
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

  app.post("/api/v1/accounts/:accountId/conversations", async (request, reply) => {
    const body = createConversationSchema.parse(request.body ?? {});
    const inboxId = body.inbox_id ?? body.inboxId;
    const phone = body.phone ?? body.source_id;
    if (!inboxId || !phone) {
      throw new AppError(
        "inbox_id y phone (o source_id) son obligatorios",
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

  app.get("/api/v1/accounts/:accountId/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(await getConversationById(id));
  });

  app.get(
    "/api/v1/accounts/:accountId/conversations/:id/messages",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const payload = await getConversationMessages(id);
      return reply.send({ payload });
    }
  );

  app.post(
    "/api/v1/accounts/:accountId/conversations/:id/messages",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = createMessageSchema.parse(request.body ?? {});
      const agentId = await resolveApiActorAgentId();

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

        const message = await sendWhatsAppTemplate(id, agentId, {
          templateName: template.name,
          language: template.language,
          content: body.content,
          bodyParameters,
          headerParameters,
          buttonUrlParameters: buttonUrlParameters?.length ? buttonUrlParameters : undefined,
          clientMessageId: body.client_message_id ?? body.clientMessageId,
        });

        return reply.status(200).send(message);
      }

      const message = await sendAgentMessage(id, agentId, {
        content: body.content,
        isPrivate: body.private ?? body.isPrivate,
        replyToMessageId: body.reply_to_message_id ?? body.replyToMessageId,
        clientMessageId: body.client_message_id ?? body.clientMessageId,
      });

      return reply.status(200).send(message);
    }
  );

  app.get(
    "/api/v1/accounts/:accountId/conversations/:id/labels",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const payload = await listConversationLabelNames(id);
      return reply.send({ payload });
    }
  );

  app.post(
    "/api/v1/accounts/:accountId/conversations/:id/labels",
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
    "/api/v1/accounts/:accountId/conversations/:id/toggle_status",
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
    "/api/v1/accounts/:accountId/conversations/:id/assignments",
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
}
