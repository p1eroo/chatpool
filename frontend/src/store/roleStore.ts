import { create } from "zustand";
import { getDefaultPermissions } from "@/lib/agentPermissions";
import type { AgentPermissions, Role } from "@/types";

const STORAGE_KEY = "chatpool-roles";

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

function loadRoles(): Role[] {
  if (typeof window === "undefined") return seedRoles;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Role[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const systemIds = new Set(seedRoles.map((role) => role.id));
        const custom = parsed.filter((role) => !systemIds.has(role.id));
        const system = seedRoles.map((seed) => {
          const savedSystem = parsed.find((role) => role.id === seed.id);
          return savedSystem ? { ...seed, permissions: savedSystem.permissions } : seed;
        });
        return [...system, ...custom];
      }
    }
  } catch {
    // ignore invalid storage
  }

  return seedRoles;
}

function saveRoles(roles: Role[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
}

interface RoleState {
  roles: Role[];
  addRole: (name: string, permissions?: AgentPermissions) => Role | null;
  updateRole: (
    id: string,
    patch: Partial<Pick<Role, "name" | "permissions">>
  ) => boolean;
  removeRole: (id: string) => boolean;
  getRoleById: (id: string) => Role | undefined;
  getRoleName: (id: string) => string;
}

export const useRoleStore = create<RoleState>((set, get) => ({
  roles: loadRoles(),

  addRole: (name, permissions) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    if (
      get().roles.some(
        (role) => role.name.trim().toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      return null;
    }

    const role: Role = {
      id: `role-${Date.now()}`,
      name: trimmedName,
      permissions: permissions ?? getDefaultPermissions("agent"),
    };

    const roles = [...get().roles, role];
    saveRoles(roles);
    set({ roles });
    return role;
  },

  updateRole: (id, patch) => {
    const roles = get().roles.map((role) =>
      role.id === id ? { ...role, ...patch, name: patch.name?.trim() || role.name } : role
    );
    saveRoles(roles);
    set({ roles });
    return true;
  },

  removeRole: (id) => {
    const role = get().getRoleById(id);
    if (!role || role.isSystem) return false;

    const roles = get().roles.filter((item) => item.id !== id);
    saveRoles(roles);
    set({ roles });
    return true;
  },

  getRoleById: (id) => get().roles.find((role) => role.id === id),

  getRoleName: (id) => get().getRoleById(id)?.name ?? "Sin rol",
}));
