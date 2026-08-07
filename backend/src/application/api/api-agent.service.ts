import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";

/**
 * Resuelve el agente que actúa en nombre de la Application API (n8n / bots).
 * Prioridad: API_AGENT_ID → primer admin activo → primer agente activo.
 */
export async function resolveApiActorAgentId(): Promise<string> {
  if (env.API_AGENT_ID) {
    const agent = await prisma.agent.findFirst({
      where: { id: env.API_AGENT_ID, active: true },
      select: { id: true },
    });
    if (!agent) {
      throw new NotFoundError(
        "API_AGENT_ID no corresponde a un agente activo. Revisa la configuración."
      );
    }
    return agent.id;
  }

  const admin = await prisma.agent.findFirst({
    where: { active: true, roleId: "role-admin" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (admin) return admin.id;

  const anyAgent = await prisma.agent.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!anyAgent) {
    throw new AppError(
      "No hay agentes activos para atribuir acciones de la API",
      503,
      "API_AGENT_MISSING"
    );
  }

  return anyAgent.id;
}
