import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { mapConversation } from "../mappers.js";
import { conversationRealtimeInclude } from "../realtime/realtime.service.js";
import {
  assertAgentCanAccessInbox,
  listInboxIdsForAgent,
} from "../inboxes/inbox-access.service.js";

const SEARCH_MIN_QUERY = 2;
const SEARCH_LIMIT = 80;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Búsqueda general de una bandeja: contacto + historial de mensajes
 * (no solo el último mensaje visible en el listado).
 */
export async function searchConversations(params: {
  agentId: string;
  inboxId?: string;
  q: string;
}) {
  const query = params.q.trim();
  if (query.length < SEARCH_MIN_QUERY) return [];

  const where: Prisma.ConversationWhereInput = {};

  if (params.inboxId) {
    await assertAgentCanAccessInbox(params.agentId, params.inboxId);
    where.inboxId = params.inboxId;
  } else {
    const accessibleInboxIds = await listInboxIdsForAgent(params.agentId);
    if (accessibleInboxIds.length === 0) return [];
    where.inboxId = { in: accessibleInboxIds };
  }

  const digits = digitsOnly(query);
  const contactOrMessage: Prisma.ConversationWhereInput[] = [
    { contact: { name: { contains: query, mode: "insensitive" } } },
    { contact: { email: { contains: query, mode: "insensitive" } } },
    { contact: { phone: { contains: query, mode: "insensitive" } } },
    { contact: { waId: { contains: query, mode: "insensitive" } } },
    {
      messages: {
        some: { content: { contains: query, mode: "insensitive" } },
      },
    },
  ];

  if (digits.length >= SEARCH_MIN_QUERY && digits !== query) {
    contactOrMessage.push(
      { contact: { phone: { contains: digits } } },
      { contact: { waId: { contains: digits } } },
      {
        messages: {
          some: { content: { contains: digits, mode: "insensitive" } },
        },
      }
    );
  }

  const rows = await prisma.conversation.findMany({
    where: { ...where, OR: contactOrMessage },
    include: conversationRealtimeInclude,
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: SEARCH_LIMIT,
  });

  const conversationIds = rows.map((row) => row.id);
  const contentFilters: Prisma.MessageWhereInput[] = [
    { content: { contains: query, mode: "insensitive" } },
  ];
  if (digits.length >= SEARCH_MIN_QUERY && digits !== query) {
    contentFilters.push({ content: { contains: digits, mode: "insensitive" } });
  }

  const matchedMessages =
    conversationIds.length === 0
      ? []
      : await prisma.message.findMany({
          where: {
            conversationId: { in: conversationIds },
            OR: contentFilters,
          },
          select: { id: true, conversationId: true },
          orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
        });

  const matchedMessageByConversation = new Map<string, string>();
  for (const message of matchedMessages) {
    if (!matchedMessageByConversation.has(message.conversationId)) {
      matchedMessageByConversation.set(message.conversationId, message.id);
    }
  }

  return rows.map((row) => ({
    conversation: mapConversation(row),
    matchedMessageId: matchedMessageByConversation.get(row.id) ?? null,
  }));
}
