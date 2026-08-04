import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, ForbiddenError, NotFoundError } from "../../domain/errors.js";
import {
  normalizePermissions,
  type AgentPermissions,
  type PermissionKey,
  PERMISSION_KEYS,
} from "../../shared/permissions.js";

function mapRole(role: {
  id: string;
  name: string;
  permissions: unknown;
  isSystem: boolean;
}) {
  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem,
    permissions: normalizePermissions(role.permissions),
  };
}

export async function listRoles() {
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
  return roles.map(mapRole);
}

export async function createRole(input: {
  name: string;
  permissions?: Partial<AgentPermissions>;
}) {
  const name = input.name.trim();
  if (!name) throw new AppError("El nombre del rol es obligatorio", 400, "INVALID_ROLE");

  const existing = await prisma.role.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    throw new AppError("Ya existe un rol con ese nombre", 409, "ROLE_NAME_TAKEN");
  }

  const permissions = normalizePermissions({
    ...normalizePermissions(undefined),
    ...input.permissions,
  });

  const role = await prisma.role.create({
    data: {
      id: `role-${Date.now()}`,
      name,
      isSystem: false,
      permissions,
    },
  });

  return mapRole(role);
}

export async function updateRole(
  id: string,
  input: { name?: string; permissions?: Partial<AgentPermissions> }
) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new NotFoundError("Rol no encontrado");

  const data: { name?: string; permissions?: AgentPermissions } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AppError("El nombre del rol es obligatorio", 400, "INVALID_ROLE");

    const duplicate = await prisma.role.findFirst({
      where: {
        id: { not: id },
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (duplicate) {
      throw new AppError("Ya existe un rol con ese nombre", 409, "ROLE_NAME_TAKEN");
    }
    data.name = name;
  }

  if (input.permissions !== undefined) {
    if (role.isSystem && role.id === "role-admin") {
      // Admin always keeps full permissions
      const full = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])) as AgentPermissions;
      data.permissions = full;
    } else {
      data.permissions = normalizePermissions({
        ...normalizePermissions(role.permissions),
        ...input.permissions,
      });
    }
  }

  const updated = await prisma.role.update({
    where: { id },
    data,
  });

  return mapRole(updated);
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { agents: true } } },
  });
  if (!role) throw new NotFoundError("Rol no encontrado");
  if (role.isSystem) {
    throw new ForbiddenError("No se pueden eliminar roles del sistema");
  }
  if (role._count.agents > 0) {
    throw new AppError(
      "No se puede eliminar un rol con agentes asignados",
      409,
      "ROLE_IN_USE"
    );
  }

  await prisma.role.delete({ where: { id } });
}

export type { AgentPermissions, PermissionKey };
