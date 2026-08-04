import type {
  AgentProfile,
  ChannelType,
  Contact,
  Conversation,
  Inbox,
  InboxSettings,
  Label,
  Message,
  MessageReply,
} from "../types/api-responses.js";
import { resolvePublicFileUrl } from "./media/media-storage.service.js";

export const messageInclude = {
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

function mapMessageReply(
  reply:
    | {
        id: string;
        content: string;
        senderType: string;
        senderName: string | null;
        senderAgent?: { name: string } | null;
        senderContact?: { name: string } | null;
      }
    | null
    | undefined
): MessageReply | undefined {
  if (!reply) return undefined;

  return {
    id: reply.id,
    content: reply.content,
    senderName:
      reply.senderName ?? reply.senderAgent?.name ?? reply.senderContact?.name ?? undefined,
    senderType: reply.senderType as MessageReply["senderType"],
  };
}

export function mapAgentProfile(agent: {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  email: string | null;
  avatar: string;
  status: string;
  roleId: string;
  active: boolean;
}): AgentProfile {
  return {
    id: agent.id,
    name: agent.name,
    username: agent.username,
    phone: agent.phone ?? undefined,
    email: agent.email ?? undefined,
    avatar: agent.avatar,
    status: agent.status as AgentProfile["status"],
    roleId: agent.roleId,
    active: agent.active,
  };
}

export function mapContact(contact: {
  id: string;
  inboxId: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  lastSeen: Date | null;
  isBlocked: boolean;
}): Contact {
  return {
    id: contact.id,
    inboxId: contact.inboxId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone ?? undefined,
    avatar: contact.avatar ?? undefined,
    lastSeen: contact.lastSeen ?? undefined,
    isBlocked: contact.isBlocked,
  };
}

export function mapMessage(message: {
  id: string;
  conversationId: string;
  content: string;
  senderType: string;
  senderAgentId: string | null;
  senderContactId: string | null;
  senderName: string | null;
  isPrivate: boolean;
  attachedToMessageId: string | null;
  contentType: string;
  fileName: string | null;
  fileSize: number | null;
  fileKey: string | null;
  mimeType: string | null;
  mediaExternalId: string | null;
  externalId: string | null;
  status: string;
  sortOrder: number;
  createdAt: Date;
  senderAgent?: { name: string } | null;
  senderContact?: { name: string } | null;
  replyToMessage?: Parameters<typeof mapMessageReply>[0];
}): Message {
  const fileUrl = resolvePublicFileUrl(message.fileKey);
  const hasAttachment =
    message.contentType !== "text" &&
    Boolean(message.fileKey || message.mediaExternalId || message.fileName);

  return {
    id: message.id,
    conversationId: message.conversationId,
    content: message.content,
    senderType: message.senderType as Message["senderType"],
    senderId: message.senderAgentId ?? message.senderContactId ?? undefined,
    senderName:
      message.senderName ??
      message.senderAgent?.name ??
      message.senderContact?.name ??
      undefined,
    isPrivate: message.isPrivate,
    attachedToMessageId: message.attachedToMessageId ?? undefined,
    replyTo: mapMessageReply(message.replyToMessage),
    contentType: message.contentType as Message["contentType"],
    fileName: message.fileName ?? undefined,
    fileSize: message.fileSize ?? undefined,
    fileUrl,
    attachmentUrl: hasAttachment
      ? `/conversations/${message.conversationId}/messages/${message.id}/attachment`
      : undefined,
    mimeType: message.mimeType ?? undefined,
    externalId: message.externalId ?? undefined,
    sortOrder: message.sortOrder,
    createdAt: message.createdAt.toISOString(),
    status: message.status as Message["status"],
  };
}

export function mapConversation(
  row: {
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
    labels: Array<{ label: { id: string; name: string; color: string; inboxId: string } }>;
    messages: Array<Parameters<typeof mapMessage>[0]>;
  }
): Conversation {
  const mappedLast = row.messages[0] ? mapMessage(row.messages[0]) : null;
  const lastMessage = mappedLast?.senderType === "system" ? null : mappedLast;

  return {
    id: row.id,
    inboxId: row.inboxId,
    contact: mapContact(row.contact),
    assignee: row.assignee ? mapAgentProfile(row.assignee) : undefined,
    lastMessage,
    unreadCount: row.unreadCount,
    status: row.status as Conversation["status"],
    priority: row.priority as Conversation["priority"],
    labels: row.labels.map((item) => mapLabel(item.label)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    isTyping: row.isTyping,
    channelType: row.inbox.channelType as ChannelType,
  };
}

export function mapLabel(label: {
  id: string;
  name: string;
  color: string;
  inboxId: string;
}): Label {
  return { id: label.id, name: label.name, color: label.color, inboxId: label.inboxId };
}

export function mapInbox(
  inbox: {
    id: string;
    name: string;
    channelType: string;
    icon: string;
    conversations?: Array<{ unreadCount: number }>;
  }
): Inbox {
  const unreadCount =
    inbox.conversations?.reduce((sum, item) => sum + item.unreadCount, 0) ?? 0;

  return {
    id: inbox.id,
    name: inbox.name,
    channelType: inbox.channelType as Inbox["channelType"],
    unreadCount,
    icon: inbox.icon,
  };
}

export function mapInboxSettings(settings: {
  inboxId: string;
  detail: string;
  status: string;
  provider: string;
  providerResource: string;
  webhookUrl: string | null;
  webhookVerifyToken?: string | null;
  description: string | null;
  whatsappProvider: string | null;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  assignedAgentIds?: string[];
}): InboxSettings {
  return {
    inboxId: settings.inboxId,
    detail: settings.detail,
    status: settings.status as InboxSettings["status"],
    provider: settings.provider as InboxSettings["provider"],
    providerResource: settings.providerResource,
    webhookUrl: settings.webhookUrl ?? undefined,
    webhookVerifyToken: settings.webhookVerifyToken ?? undefined,
    description: settings.description ?? undefined,
    whatsappProvider: (settings.whatsappProvider as InboxSettings["whatsappProvider"]) ?? undefined,
    phoneNumberId: settings.phoneNumberId ?? undefined,
    businessAccountId: settings.businessAccountId ?? undefined,
    assignedAgentIds: settings.assignedAgentIds ?? [],
  };
}
