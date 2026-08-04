import { apiRequest } from "@/api/client";
import { env } from "@/config/env";
import { createLocalRole, useRoleStore } from "@/store/roleStore";
import type { RoleDto } from "@/types/api";
import type { AgentPermissions, Role } from "@/types";

function toRole(dto: RoleDto): Role {
  return {
    id: dto.id,
    name: dto.name,
    isSystem: dto.isSystem,
    permissions: dto.permissions,
  };
}

export const roleApiService = {
  async list(): Promise<Role[]> {
    if (env.useMock) {
      return useRoleStore.getState().roles;
    }
    const rows = await apiRequest<RoleDto[]>("/roles");
    return rows.map(toRole);
  },

  async create(name: string, permissions?: AgentPermissions): Promise<Role> {
    if (env.useMock) {
      const role = createLocalRole(name, permissions);
      const roles = useRoleStore.getState().roles;
      if (roles.some((item) => item.name.trim().toLowerCase() === role.name.toLowerCase())) {
        throw new Error("Ya existe un rol con ese nombre");
      }
      useRoleStore.getState().upsertRole(role);
      return role;
    }
    const row = await apiRequest<RoleDto>("/roles", {
      method: "POST",
      body: { name, permissions },
    });
    return toRole(row);
  },

  async update(
    id: string,
    patch: Partial<Pick<Role, "name" | "permissions">>
  ): Promise<Role> {
    if (env.useMock) {
      const current = useRoleStore.getState().getRoleById(id);
      if (!current) throw new Error("Rol no encontrado");
      const next = {
        ...current,
        ...patch,
        name: patch.name?.trim() || current.name,
      };
      useRoleStore.getState().upsertRole(next);
      return next;
    }
    const row = await apiRequest<RoleDto>(`/roles/${id}`, {
      method: "PATCH",
      body: patch,
    });
    return toRole(row);
  },

  async remove(id: string): Promise<void> {
    if (env.useMock) {
      const role = useRoleStore.getState().getRoleById(id);
      if (!role || role.isSystem) throw new Error("No se pudo eliminar el rol");
      useRoleStore.getState().removeRoleLocal(id);
      return;
    }
    await apiRequest(`/roles/${id}`, { method: "DELETE" });
  },
};
