import { prisma } from "../../infrastructure/database/prisma.client.js";
import { ForbiddenError, UnauthorizedError } from "../../domain/errors.js";
import {
  normalizePermissions,
  type AgentPermissions,
  type PermissionKey,
} from "../../shared/permissions.js";

export async function getPermissionsForAgent(agentId: string): Promise<AgentPermissions> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      active: true,
      role: { select: { permissions: true } },
    },
  });

  if (!agent?.active) {
    throw new UnauthorizedError();
  }

  return normalizePermissions(agent.role.permissions);
}

export async function assertAgentPermission(
  agentId: string,
  ...keys: PermissionKey[]
): Promise<AgentPermissions> {
  const permissions = await getPermissionsForAgent(agentId);
  const allowed = keys.some((key) => permissions[key]);

  if (!allowed) {
    throw new ForbiddenError();
  }

  return permissions;
}
