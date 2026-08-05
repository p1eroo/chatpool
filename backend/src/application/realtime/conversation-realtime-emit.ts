import type { Conversation, Message } from "../../types/api-responses.js";
import { mapAgentProfile, mapContact, mapMessage } from "../mappers.js";

/** Campos mínimos de conversación para emit tras crear mensaje (sin labels ni preview query). */
export const conversationMessageEmitSelect = {
  id: true,
  inboxId: true,
  status: true,
  priority: true,
  unreadCount: true,
  isTyping: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
  contact: {
    select: {
      id: true,
      inboxId: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      company: true,
      waId: true,
      avatar: true,
      lastSeen: true,
      isBlocked: true,
    },
  },
  assignee: {
    select: {
      id: true,
      name: true,
      username: true,
      phone: true,
      email: true,
      avatar: true,
      status: true,
      roleId: true,
      active: true,
    },
  },
  inbox: { select: { channelType: true } },
} as const;

export type ConversationMessageEmitRow = {
  id: string;
  inboxId: string;
  status: string;
  priority: string;
  unreadCount: number;
  isTyping: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  contact: Parameters<typeof mapContact>[0];
  assignee: Parameters<typeof mapAgentProfile>[0] | null;
  inbox: { channelType: string };
};

type MessageRow = Parameters<typeof mapMessage>[0];

/** Payload WS de conversación sin recargar labels ni último mensaje vía join. */
export function mapConversationMessageEmit(
  row: ConversationMessageEmitRow,
  messageRow: MessageRow,
  options?: { assigneeOverride?: Parameters<typeof mapAgentProfile>[0] | null }
): Conversation {
  const lastMessage = mapMessage(messageRow);
  const assigneeRow =
    options?.assigneeOverride !== undefined ? options.assigneeOverride : row.assignee;

  return {
    id: row.id,
    inboxId: row.inboxId,
    contact: mapContact(row.contact),
    assignee: assigneeRow ? mapAgentProfile(assigneeRow) : undefined,
    lastMessage: lastMessage.senderType === "system" ? null : lastMessage,
    unreadCount: row.unreadCount,
    status: row.status as Conversation["status"],
    priority: row.priority as Conversation["priority"],
    labels: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    isTyping: row.isTyping,
    channelType: row.inbox.channelType as Conversation["channelType"],
  };
}

export function messageCreateInclude(replyToMessageId?: string | null) {
  if (replyToMessageId) {
    return {
      senderAgent: { select: { name: true } },
      senderContact: { select: { name: true } },
      replyToMessage: {
        select: {
          id: true,
          content: true,
          senderType: true,
          senderName: true,
          senderAgent: { select: { name: true } },
          senderContact: { select: { name: true } },
        },
      },
    } as const;
  }

  return {
    senderAgent: { select: { name: true } },
    senderContact: { select: { name: true } },
  } as const;
}

export const agentNameSelect = { id: true, name: true } as const;

export const conversationSendContextSelect = {
  id: true,
  inboxId: true,
  assigneeId: true,
  status: true,
  priority: true,
  unreadCount: true,
  isTyping: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
  contact: conversationMessageEmitSelect.contact,
  inbox: conversationMessageEmitSelect.inbox,
  assignee: conversationMessageEmitSelect.assignee,
} as const;
