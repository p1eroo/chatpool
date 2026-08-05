import { randomUUID } from "node:crypto";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { verifyPassword } from "../../infrastructure/security/password.service.js";
import { toAgentProfile } from "../../infrastructure/webhooks/webhook-url.builder.js";
import { SessionRevokedError, UnauthorizedError } from "../../domain/errors.js";
import { normalizePermissions } from "../../shared/permissions.js";

function toAuthAgentProfile(agent: {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  email: string | null;
  avatar: string;
  status: string;
  roleId: string;
  active: boolean;
  role: { name: string; permissions: unknown };
}) {
  return {
    ...toAgentProfile(agent),
    roleName: agent.role.name,
    permissions: normalizePermissions(agent.role.permissions),
  };
}

export async function loginAgent(username: string, password: string) {
  const agent = await prisma.agent.findFirst({
    where: {
      username: { equals: username.trim(), mode: "insensitive" },
      active: true,
    },
    include: { role: true },
  });

  if (!agent) {
    throw new UnauthorizedError("Usuario o contraseña incorrectos");
  }

  const valid = await verifyPassword(password, agent.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Usuario o contraseña incorrectos");
  }

  return toAuthAgentProfile(agent);
}

export async function getAgentById(agentId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { role: true },
  });
  if (!agent || !agent.active) return null;
  return toAuthAgentProfile(agent);
}

/** Nueva sesión: invalida cualquier login previo en otro equipo. */
export async function rotateAgentSession(agentId: string): Promise<string> {
  const sessionId = randomUUID();

  await prisma.agent.update({
    where: { id: agentId },
    data: { activeSessionId: sessionId },
  });

  return sessionId;
}

export async function clearAgentSession(agentId: string): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: { activeSessionId: null },
  });
}

/** Sesión válida si el sid del token coincide con active_session_id del agente. */
export async function assertActiveAgentSession(
  agentId: string,
  sessionId: string | undefined
): Promise<void> {
  if (!sessionId) {
    throw new UnauthorizedError();
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { activeSessionId: true, active: true },
  });

  if (!agent?.active || !agent.activeSessionId || agent.activeSessionId !== sessionId) {
    throw new SessionRevokedError();
  }
}

export async function validateAgentSession(
  agentId: string,
  sessionId: string | undefined
): Promise<boolean> {
  try {
    await assertActiveAgentSession(agentId, sessionId);
    return true;
  } catch {
    return false;
  }
}
