import { prisma } from "../../infrastructure/database/prisma.client.js";
import { broadcastRealtime } from "../../infrastructure/realtime/realtime-hub.js";
import { ForbiddenError, NotFoundError } from "../../domain/errors.js";
import { assertAgentCanAccessConversation } from "../inboxes/inbox-access.service.js";

const TYPING_TRUE_THROTTLE_MS = 1_000;
const CONVERSATION_ID_MAX = 64;

export type AgentTypingClient = {
  send: (data: string) => void;
  agentId: string;
  agentName: string | null;
  allowedConversations: Map<string, string>;
  typingConversationIds: Set<string>;
  lastTypingTrueAt: Map<string, number>;
};

type IncomingTypingMessage = {
  type?: unknown;
  payload?: {
    conversationId?: unknown;
    isTyping?: unknown;
  };
};

function parseIncomingTyping(raw: unknown): {
  conversationId: string;
  isTyping: boolean;
} | null {
  const text =
    typeof raw === "string"
      ? raw
      : Buffer.isBuffer(raw)
        ? raw.toString("utf8")
        : Array.isArray(raw)
          ? Buffer.concat(raw).toString("utf8")
          : raw instanceof ArrayBuffer
            ? Buffer.from(raw).toString("utf8")
            : null;

  if (!text) return null;

  let parsed: IncomingTypingMessage;
  try {
    parsed = JSON.parse(text) as IncomingTypingMessage;
  } catch {
    return null;
  }

  if (parsed.type !== "conversation.typing") return null;

  const conversationId =
    typeof parsed.payload?.conversationId === "string"
      ? parsed.payload.conversationId.trim()
      : "";
  if (!conversationId || conversationId.length > CONVERSATION_ID_MAX) return null;

  if (typeof parsed.payload?.isTyping !== "boolean") return null;

  return { conversationId, isTyping: parsed.payload.isTyping };
}

async function resolveAgentName(client: AgentTypingClient): Promise<string | null> {
  if (client.agentName) return client.agentName;

  const agent = await prisma.agent.findUnique({
    where: { id: client.agentId },
    select: { name: true, active: true },
  });
  if (!agent?.active) return null;

  client.agentName = agent.name;
  return agent.name;
}

async function resolveInboxId(
  client: AgentTypingClient,
  conversationId: string
): Promise<string | null> {
  const cached = client.allowedConversations.get(conversationId);
  if (cached) return cached;

  try {
    const { inboxId } = await assertAgentCanAccessConversation(
      client.agentId,
      conversationId
    );
    client.allowedConversations.set(conversationId, inboxId);
    return inboxId;
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return null;
    }
    throw error;
  }
}

function emitTyping(
  client: AgentTypingClient,
  conversationId: string,
  inboxId: string,
  agentName: string,
  isTyping: boolean
): void {
  broadcastRealtime({
    type: "conversation.typing",
    payload: {
      conversationId,
      inboxId,
      agentId: client.agentId,
      agentName,
      isTyping,
    },
  });
}

export async function handleIncomingTypingMessage(
  client: AgentTypingClient,
  raw: unknown
): Promise<void> {
  const incoming = parseIncomingTyping(raw);
  if (!incoming) return;

  const agentName = await resolveAgentName(client);
  if (!agentName) return;

  const inboxId = await resolveInboxId(client, incoming.conversationId);
  if (!inboxId) return;

  if (incoming.isTyping) {
    client.typingConversationIds.add(incoming.conversationId);
    const last = client.lastTypingTrueAt.get(incoming.conversationId) ?? 0;
    if (Date.now() - last < TYPING_TRUE_THROTTLE_MS) return;

    client.lastTypingTrueAt.set(incoming.conversationId, Date.now());
    emitTyping(client, incoming.conversationId, inboxId, agentName, true);
    return;
  }

  if (!client.typingConversationIds.delete(incoming.conversationId)) return;
  client.lastTypingTrueAt.delete(incoming.conversationId);
  emitTyping(client, incoming.conversationId, inboxId, agentName, false);
}

export function clearTypingOnDisconnect(client: AgentTypingClient): void {
  if (client.typingConversationIds.size === 0) return;

  const agentName = client.agentName;
  const conversationIds = [...client.typingConversationIds];
  client.typingConversationIds.clear();
  client.lastTypingTrueAt.clear();

  if (!agentName) return;

  for (const conversationId of conversationIds) {
    const inboxId = client.allowedConversations.get(conversationId);
    if (!inboxId) continue;
    emitTyping(client, conversationId, inboxId, agentName, false);
  }
}
