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
  description?: string;
  whatsappProvider?: "meta-cloud";
  phoneNumberId?: string;
  businessAccountId?: string;
  apiKey?: string;
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

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  senderType: "agent" | "contact" | "system" | "bot";
  senderId?: string;
  senderName?: string;
  isPrivate: boolean;
  attachedToMessageId?: string;
  replyTo?: MessageReply;
  contentType: "text" | "image" | "file" | "audio";
  audioUrl?: string;
  audioDuration?: number;
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  attachmentUrl?: string;
  externalId?: string;
  sortOrder?: number;
  createdAt: Date;
  status?: "sent" | "delivered" | "read" | "failed";
}

export interface Label {
  id: string;
  name: string;
  color: string;
  inboxId: string;
}

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
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
