import { env } from "../../config/env.js";

export function buildProviderWebhookUrl(provider: string): string {
  return `${env.WEBHOOK_BASE_URL.replace(/\/$/, "")}/${provider}`;
}

export function buildInboxWebhookUrl(provider: string, inboxId: string): string {
  return `${buildProviderWebhookUrl(provider)}/${inboxId}`;
}

export function createWebhookVerifyToken(inboxId: string): string {
  return `cp_${inboxId.slice(-8)}_${Date.now().toString(36)}`;
}

export function toAgentProfile(agent: {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  email: string | null;
  avatar: string;
  status: string;
  roleId: string;
  active: boolean;
}) {
  return {
    id: agent.id,
    name: agent.name,
    username: agent.username,
    phone: agent.phone ?? undefined,
    email: agent.email ?? undefined,
    avatar: agent.avatar,
    status: agent.status,
    roleId: agent.roleId,
    active: agent.active,
  };
}
