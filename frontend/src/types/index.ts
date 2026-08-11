export type ChannelType = "website" | "email" | "whatsapp" | "facebook" | "instagram" | "telegram" | "sms" | "api";

export type ConversationStatus = "open" | "resolved";

export type Priority = "urgent" | "high" | "medium" | "low" | "none";

export type AgentStatus = "online" | "away" | "busy" | "offline";

export type AgentRole = "admin" | "agent";

export interface Role {
  id: string;
  name: string;
  permissions: AgentPermissions;
  isSystem?: boolean;
}

export interface AgentPermissions {
  manageInboxes: boolean;
  manageAgents: boolean;
  manageIntegrations: boolean;
  viewReports: boolean;
  assignConversations: boolean;
  resolveConversations: boolean;
  deleteConversations: boolean;
  sendMessages: boolean;
  manageLabels: boolean;
  manageCannedResponses: boolean;
}

export interface AgentProfile {
  id: string;
  name: string;
  username: string;
  phone?: string;
  email?: string;
  avatar: string;
  status: AgentStatus;
  roleId: string;
  roleName?: string;
  permissions?: AgentPermissions;
  active?: boolean;
}

/** Agente completo; `password` solo en mock/local al crear o editar. */
export interface Agent extends AgentProfile {
  password?: string;
}

export interface Inbox {
  id: string;
  name: string;
  channelType: ChannelType;
  unreadCount: number;
  icon: string;
}

export type InboxStatus = "active" | "pending" | "disabled";

export type IntegrationProvider = "meta" | "email" | "website";

export interface InboxSettings {
  inboxId: string;
  detail: string;
  status: InboxStatus;
  provider: IntegrationProvider;
  providerResource: string;
  webhookUrl?: string;
  /** Verify token para el challenge GET de Meta (webhook por bandeja). */
  webhookVerifyToken?: string;
  assignedAgentIds: string[];
  /** Subconjunto de assignedAgentIds que participan en autoasignación. */
  autoAssignAgentIds: string[];
  autoAssignEnabled: boolean;
  description?: string;
  whatsappProvider?: "meta-cloud";
  phoneNumberId?: string;
  businessAccountId?: string;
  apiKey?: string;
  /** Minutos de pausa del bot tras mensaje público de agente (1–1440). */
  botPauseMinutes: number;
}

export interface IntegrationAccount {
  id: string;
  name: string;
  provider: IntegrationProvider;
  description: string;
  connected: boolean;
  webhookUrl?: string;
  /** Verify token del webhook global /webhooks/meta. */
  webhookVerifyToken?: string;
}

export interface Contact {
  id: string;
  inboxId: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  company?: string;
  /** Teléfono o BSUID/LID de Meta. */
  waId?: string;
  avatar?: string;
  lastSeen?: Date;
  isBlocked?: boolean;
}

export interface MessageReply {
  id: string;
  content: string;
  senderName?: string;
  senderType: "agent" | "contact" | "bot";
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export interface MessageLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface Message {
  id: string;
  /** Id estable en UI (p. ej. pending-*) para no remontar al confirmar el envío. */
  clientId?: string;
  /** Id enviado al API para reconciliar con el mensaje persistido. */
  clientMessageId?: string;
  conversationId: string;
  content: string;
  senderType: "agent" | "contact" | "system" | "bot";
  senderId?: string;
  senderName?: string;
  isPrivate: boolean;
  attachedToMessageId?: string;
  replyTo?: MessageReply;
  contentType: "text" | "image" | "file" | "audio" | "sticker" | "location";
  audioUrl?: string;
  audioDuration?: number;
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  attachmentUrl?: string;
  location?: MessageLocation;
  externalId?: string;
  sortOrder?: number;
  createdAt: Date;
  status?: "pending" | "sent" | "delivered" | "read" | "failed";
  linkPreview?: LinkPreview;
  linkPreviewSuppressed?: boolean;
}

export interface SavedSticker {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl?: string;
  createdAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  inboxId: string;
}

export interface CannedResponse {
  id: string;
  inboxId: string;
  title: string;
  content: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  fileUrl?: string;
  attachmentUrl?: string;
}

export interface Conversation {
  id: string;
  inboxId: string;
  contact: Contact;
  assignee?: Agent;
  lastMessage: Message | null;
  unreadCount: number;
  status: ConversationStatus;
  priority: Priority;
  labels: Label[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  /** Hasta cuándo el bot está pausado; null = bot activo. */
  botPausedUntil: Date | null;
  isTyping: boolean;
  channelType: ChannelType;
}

export interface NavItem {
  id: string;
  icon: string;
  label: string;
  path: string;
  badge?: number;
}
