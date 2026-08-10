import type { AgentPermissions, AgentStatus, IntegrationProvider } from "@/types";

/** Perfil de agente tal como lo devuelve la API (sin contraseña). */
export interface AgentProfileDto {
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

export interface RoleDto {
  id: string;
  name: string;
  isSystem?: boolean;
  permissions: AgentPermissions;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  agent: AgentProfileDto;
}

export interface ApiErrorBody {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

/** Credenciales Meta Cloud API para conectar un número WhatsApp. */
export interface MetaInboxCredentialsDto {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  syncWhatsAppContacts?: boolean;
}

export interface VerifyMetaConnectionRequest extends MetaInboxCredentialsDto {
  inboxId: string;
}

export interface VerifyMetaConnectionResponse {
  ok: boolean;
  phoneNumber?: string;
  verifiedName?: string;
  webhookSubscribed?: boolean;
  contactSyncRequested?: boolean;
  contactSyncError?: string;
  error?: string;
}

export interface RegisterWebhookRequest {
  inboxId: string;
  provider: IntegrationProvider;
}

export interface RegisterWebhookResponse {
  webhookUrl: string;
  verifyToken: string;
  subscribed: boolean;
}

export interface IntegrationAccountDto {
  id: string;
  name: string;
  provider: IntegrationProvider;
  description: string;
  connected: boolean;
  webhookUrl?: string;
  webhookVerifyToken?: string;
}

/** Eventos de webhooks salientes (estilo Chatwoot). */
export type OutgoingWebhookEvent =
  | "message_created"
  | "message_updated"
  | "conversation_created"
  | "conversation_updated"
  | "conversation_status_changed";

export interface OutgoingWebhookDto {
  id: string;
  inboxId: string;
  name: string | null;
  url: string;
  subscriptions: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutgoingWebhookRequest {
  inboxId: string;
  url: string;
  name?: string | null;
  subscriptions: OutgoingWebhookEvent[];
  enabled?: boolean;
}

export interface UpdateOutgoingWebhookRequest {
  url?: string;
  name?: string | null;
  subscriptions?: OutgoingWebhookEvent[];
  enabled?: boolean;
}
