export type AgentStatus = "online" | "away" | "busy" | "offline";
export type ChannelType =
  | "website"
  | "email"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "telegram"
  | "sms"
  | "api";
export type ConversationStatus = "open" | "resolved";
export type Priority = "urgent" | "high" | "medium" | "low" | "none";
export type InboxStatus = "active" | "pending" | "disabled";
export type IntegrationProvider = "meta" | "email" | "website";

export interface AgentProfile {
  id: string;
  name: string;
  username: string;
  phone?: string;
  email?: string;
  avatar: string;
  status: AgentStatus;
  roleId: string;
  active?: boolean;
}

export interface Contact {
  id: string;
  inboxId: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  company?: string;
  /** Teléfono o BSUID/LID de Meta (clave interna WhatsApp). */
  waId?: string;
  avatar?: string;
  lastSeen?: Date | string;
  isBlocked?: boolean;
}

export interface MessageReply {
  id: string;
  content: string;
  senderName?: string;
  senderType: "agent" | "contact" | "system" | "bot";
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
  conversationId: string;
  content: string;
  senderType: "agent" | "contact" | "system" | "bot";
  senderId?: string;
  senderName?: string;
  isPrivate: boolean;
  attachedToMessageId?: string;
  replyTo?: MessageReply;
  contentType: "text" | "image" | "file" | "audio" | "sticker" | "location";
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  attachmentUrl?: string;
  mimeType?: string;
  location?: MessageLocation;
  externalId?: string;
  sortOrder?: number;
  createdAt: string;
  status?: "pending" | "sent" | "delivered" | "read" | "failed";
  errorMessage?: string;
  clientMessageId?: string;
  linkPreview?: LinkPreview;
  linkPreviewSuppressed?: boolean;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  inboxId: string;
}

/** Sub-bandeja virtual dentro de un inbox (bandejita). */
export interface MiniInbox {
  id: string;
  inboxId: string;
  name: string;
  color: string;
  sortOrder: number;
  matchPhrases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  inboxId: string;
  contact: Contact;
  assignee?: AgentProfile;
  lastMessage: Message | null;
  unreadCount: number;
  status: ConversationStatus;
  priority: Priority;
  labels: Label[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  /** ISO hasta cuándo el bot está pausado; null = bot activo. */
  botPausedUntil: string | null;
  isTyping: boolean;
  channelType: ChannelType;
  /** Id de la bandejita (mini inbox) a la que pertenece; null = bandeja principal. */
  miniInboxId: string | null;
}

export interface Inbox {
  id: string;
  name: string;
  channelType: ChannelType;
  unreadCount: number;
  icon: string;
}

export interface InboxSettings {
  inboxId: string;
  detail: string;
  status: InboxStatus;
  provider: IntegrationProvider;
  providerResource: string;
  webhookUrl?: string;
  webhookVerifyToken?: string;
  assignedAgentIds: string[];
  /** Agentes del pool de autoasignación (subconjunto de assignedAgentIds). */
  autoAssignAgentIds: string[];
  autoAssignEnabled: boolean;
  description?: string;
  whatsappProvider?: "meta-cloud";
  phoneNumberId?: string;
  businessAccountId?: string;
  /** Minutos de pausa del bot tras mensaje público de agente (1–1440). */
  botPauseMinutes: number;
}

export interface UpdateInboxSettingsBody {
  botPauseMinutes?: number;
  autoAssignEnabled?: boolean;
  autoAssignAgentIds?: string[];
}

export interface CreateAgentBody {
  name: string;
  username: string;
  password: string;
  roleId: string;
  phone?: string;
}

export interface UpdateAgentBody {
  name?: string;
  username?: string;
  password?: string;
  roleId?: string;
  phone?: string;
  active?: boolean;
  status?: AgentStatus;
  inboxIds?: string[];
}

export interface CreateInboxBody {
  name: string;
  channelType: ChannelType;
  detail: string;
  providerResource: string;
  description?: string;
  assignedAgentIds?: string[];
  phoneNumberId?: string;
  businessAccountId?: string;
  accessToken?: string;
}

export interface SendMessageBody {
  content: string;
  isPrivate?: boolean;
  contentType?: Message["contentType"];
  fileName?: string;
  fileSize?: number;
  fileKey?: string;
  mimeType?: string;
  replyToMessageId?: string;
  /** Id estable del cliente para reconciliar UI y evitar duplicados. */
  clientMessageId?: string;
  linkPreview?: LinkPreview;
  /** Si true, no generar preview en UI ni enviar preview_url a WhatsApp. */
  suppressLinkPreview?: boolean;
}

export interface SavedSticker {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl?: string;
  createdAt: string;
}

export interface SendTemplateBody {
  /** Compat: id local `name__language` o solo name. */
  templateId?: string;
  templateName: string;
  language: string;
  /** Preview opcional; el servidor lo regenera con los parámetros. */
  content?: string;
  bodyParameters?: string[];
  headerParameters?: string[];
  /** URL HTTPS pública para header IMAGE (Meta descarga la imagen). */
  headerMediaUrl?: string;
  buttonUrlParameters?: Array<{ index: number; text: string }>;
  clientMessageId?: string;
}

export interface UpdateConversationBody {
  status?: ConversationStatus;
  assigneeId?: string | null;
  unreadCount?: number;
}
