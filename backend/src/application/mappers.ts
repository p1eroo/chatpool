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
  MiniInbox,
} from "../types/api-responses.js";
import type { Prisma } from "@prisma/client";
import { resolvePublicFileUrl } from "./media/media-storage.service.js";
import { parseLinkPreviewDeliveryPayload, isLinkPreviewSuppressed } from "../shared/link-preview.js";
import { parseTemplateButtonsFromDeliveryPayload } from "../shared/template-delivery.js";
import { parseMessageLocation } from "../shared/message-location.js";

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
  city?: string | null;
  company?: string | null;
  waId?: string | null;
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
    city: contact.city ?? undefined,
    company: contact.company ?? undefined,
    waId: contact.waId ?? undefined,
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
  location?: unknown;
  externalId: string | null;
  clientMessageId: string | null;
  deliveryPayload?: unknown;
  status: string;
  errorMessage?: string | null;
  sortOrder: number;
  createdAt: Date;
  senderAgent?: { name: string } | null;
  senderContact?: { name: string } | null;
  replyToMessage?: Parameters<typeof mapMessageReply>[0];
}): Message {
  const fileUrl = resolvePublicFileUrl(message.fileKey);
  const location = parseMessageLocation(message.location) ?? undefined;
  const hasAttachment =
    message.contentType !== "text" &&
    message.contentType !== "location" &&
    Boolean(
      message.fileKey ||
        message.mediaExternalId ||
        message.fileName ||
        message.contentType === "sticker"
    );

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
    location,
    externalId: message.externalId ?? undefined,
    clientMessageId: message.clientMessageId ?? undefined,
    sortOrder: message.sortOrder,
    createdAt: message.createdAt.toISOString(),
    status: message.status as Message["status"],
    errorMessage: message.errorMessage ?? undefined,
    linkPreview: parseLinkPreviewDeliveryPayload(
      message.deliveryPayload as Prisma.JsonValue | null | undefined
    ) ?? undefined,
    linkPreviewSuppressed: isLinkPreviewSuppressed(
      message.deliveryPayload as Prisma.JsonValue | null | undefined
    ),
    templateButtons: parseTemplateButtonsFromDeliveryPayload(
      message.deliveryPayload as Prisma.JsonValue | null | undefined
    ),
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
    botPausedUntil?: Date | null;
    miniInboxId: string | null;
    contact: Parameters<typeof mapContact>[0];
    assignee: Parameters<typeof mapAgentProfile>[0] | null;
    inbox: { channelType: string };
    labels: Array<{ label: { id: string; name: string; color: string; inboxId: string } }>;
    messages: Array<Parameters<typeof mapMessage>[0]>;
  }
): Conversation {
  const mappedLast = row.messages[0] ? mapMessage(row.messages[0]) : null;
  const lastMessage =
    mappedLast?.senderType === "system" || mappedLast?.isPrivate ? null : mappedLast;

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
    botPausedUntil: row.botPausedUntil?.toISOString() ?? null,
    isTyping: row.isTyping,
    channelType: row.inbox.channelType as ChannelType,
    miniInboxId: row.miniInboxId ?? null,
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

export function mapMiniInbox(miniInbox: {
  id: string;
  inboxId: string;
  name: string;
  color: string;
  sortOrder: number;
  matchPhrases: string[];
  createdAt: Date;
  updatedAt: Date;
}): MiniInbox {
  return {
    id: miniInbox.id,
    inboxId: miniInbox.inboxId,
    name: miniInbox.name,
    color: miniInbox.color,
    sortOrder: miniInbox.sortOrder,
    matchPhrases: miniInbox.matchPhrases,
    createdAt: miniInbox.createdAt.toISOString(),
    updatedAt: miniInbox.updatedAt.toISOString(),
  };
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
  // Badge = conversaciones con no leídos (no suma de mensajes).
  const unreadCount =
    inbox.conversations?.filter((item) => item.unreadCount > 0).length ?? 0;

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
  botPauseMinutes?: number | null;
  autoAssignEnabled?: boolean | null;
  assignedAgentIds?: string[];
  autoAssignAgentIds?: string[];
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
    botPauseMinutes: settings.botPauseMinutes ?? 15,
    autoAssignEnabled: settings.autoAssignEnabled ?? false,
    assignedAgentIds: settings.assignedAgentIds ?? [],
    autoAssignAgentIds: settings.autoAssignAgentIds ?? [],
  };
}
