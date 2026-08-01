import { randomUUID } from "node:crypto";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { verifyPassword } from "../../infrastructure/security/password.service.js";
import { toAgentProfile } from "../../infrastructure/webhooks/webhook-url.builder.js";
import { UnauthorizedError } from "../../domain/errors.js";

export async function loginAgent(username: string, password: string) {
  const agent = await prisma.agent.findFirst({
    where: {
      username: { equals: username.trim(), mode: "insensitive" },
      active: true,
    },
  });

  if (!agent) {
    throw new UnauthorizedError("Usuario o contraseña incorrectos");
  }

  const valid = await verifyPassword(password, agent.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Usuario o contraseña incorrectos");
  }

  return toAgentProfile(agent);
}

export async function getAgentById(agentId: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || !agent.active) return null;
  return toAgentProfile(agent);
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

export async function validateAgentSession(
  agentId: string,
  sessionId: string | undefined
): Promise<boolean> {
  if (!sessionId) return false;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { activeSessionId: true, active: true },
  });

  if (!agent?.active || !agent.activeSessionId) return false;
  return agent.activeSessionId === sessionId;
}

export async function clearAgentSession(agentId: string): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: { activeSessionId: null },
  });
}
