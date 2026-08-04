import { create } from "zustand";
import { getDefaultPermissions } from "@/lib/agentPermissions";
import type { AgentPermissions, Role } from "@/types";

export const SYSTEM_ROLE_IDS = {
  admin: "role-admin",
  agent: "role-agent",
} as const;

const seedRoles: Role[] = [
  {
    id: SYSTEM_ROLE_IDS.admin,
    name: "Administrador",
    isSystem: true,
    permissions: getDefaultPermissions("admin"),
  },
  {
    id: SYSTEM_ROLE_IDS.agent,
    name: "Agente",
    isSystem: true,
    permissions: getDefaultPermissions("agent"),
  },
];

interface RoleState {
  roles: Role[];
  setRoles: (roles: Role[]) => void;
  upsertRole: (role: Role) => void;
  removeRoleLocal: (id: string) => void;
  getRoleById: (id: string) => Role | undefined;
  getRoleName: (id: string) => string;
}

export const useRoleStore = create<RoleState>((set, get) => ({
  roles: seedRoles,

  setRoles: (roles) => set({ roles: roles.length > 0 ? roles : seedRoles }),

  upsertRole: (role) => {
    set((state) => {
      const exists = state.roles.some((item) => item.id === role.id);
      return {
        roles: exists
          ? state.roles.map((item) => (item.id === role.id ? role : item))
          : [...state.roles, role],
      };
    });
  },

  removeRoleLocal: (id) => {
    set((state) => ({
      roles: state.roles.filter((role) => role.id !== id),
    }));
  },

  getRoleById: (id) => get().roles.find((role) => role.id === id),

  getRoleName: (id) => get().getRoleById(id)?.name ?? "Sin rol",
}));

/** Solo para modo mock / defaults locales. */
export function createLocalRole(
  name: string,
  permissions?: AgentPermissions
): Role {
  return {
    id: `role-${Date.now()}`,
    name: name.trim(),
    permissions: permissions ?? getDefaultPermissions("agent"),
  };
}
