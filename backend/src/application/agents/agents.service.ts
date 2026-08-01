import { prisma } from "../../infrastructure/database/prisma.client.js";
import { hashPassword } from "../../infrastructure/security/password.service.js";
import { mapAgentProfile } from "../mappers.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import type { CreateAgentBody, UpdateAgentBody } from "../../types/api-responses.js";

const PROTECTED_USERNAME = "soporte";

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function listAgents() {
  const agents = await prisma.agent.findMany({ orderBy: { name: "asc" } });
  return agents.map(mapAgentProfile);
}

export async function createAgent(input: CreateAgentBody) {
  const username = normalizeUsername(input.username);
  const existing = await prisma.agent.findFirst({ where: { username } });
  if (existing) throw new AppError("El usuario ya existe");

  const agent = await prisma.agent.create({
    data: {
      name: input.name.trim(),
      username,
      passwordHash: await hashPassword(input.password),
      phone: input.phone?.trim() || null,
      avatar: input.name.trim().slice(0, 2).toUpperCase(),
      roleId: input.roleId,
    },
  });

  return mapAgentProfile(agent);
}

export async function updateAgent(id: string, input: UpdateAgentBody) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) throw new NotFoundError("Agente no encontrado");

  if (input.username) {
    const username = normalizeUsername(input.username);
    const duplicate = await prisma.agent.findFirst({
      where: { username, NOT: { id } },
    });
    if (duplicate) throw new AppError("El usuario ya existe");
  }

  const updated = await prisma.agent.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      username: input.username ? normalizeUsername(input.username) : undefined,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
      phone: input.phone !== undefined ? input.phone.trim() || null : undefined,
      roleId: input.roleId,
      active: input.active,
      status: input.status,
    },
  });

  return mapAgentProfile(updated);
}

export async function deleteAgent(id: string) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) throw new NotFoundError("Agente no encontrado");
  if (agent.username === PROTECTED_USERNAME) {
    throw new AppError("No se puede eliminar el superadmin");
  }

  const adminCount = await prisma.agent.count({
    where: { roleId: "role-admin", active: true, NOT: { id } },
  });
  if (agent.roleId === "role-admin" && adminCount === 0) {
    throw new AppError("Debe quedar al menos un administrador activo");
  }

  await prisma.agent.delete({ where: { id } });
}
