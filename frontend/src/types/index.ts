export type ChannelType = "website" | "email" | "whatsapp" | "facebook" | "instagram" | "telegram" | "sms" | "api";

export type ConversationStatus = "open" | "resolved";

export type Priority = "urgent" | "high" | "medium" | "low" | "none";

export type AgentStatus = "online" | "away" | "busy" | "offline";

export interface Agent {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status: AgentStatus;
  role: "admin" | "agent";
}

export interface Inbox {
  id: string;
  name: string;
  channelType: ChannelType;
  unreadCount: number;
  icon: string;
}

export interface Contact {
  id: string;
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
  contentType: "text" | "image" | "file";
  createdAt: Date;
  status?: "sent" | "delivered" | "read" | "failed";
}

export interface Label {
  id: string;
  name: string;
  color: string;
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
