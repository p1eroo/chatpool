import { create } from "zustand";
import { env } from "@/config/env";
import { agents as seedAgents } from "@/data/mock";
import {
  deriveUsernameFromName,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
} from "@/lib/agentCredentials";
import { getInitials } from "@/lib/agentPermissions";
import { normalizeAgentPhone } from "@/lib/agentPhone";
import { agentApiService, PROTECTED_AGENT_USERNAME } from "@/services/agentApiService";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { SYSTEM_ROLE_IDS, useRoleStore } from "@/store/roleStore";
import type { Agent } from "@/types";

const STORAGE_KEY = "chatpool-agents";
const DEFAULT_PASSWORD = "Chatpool123";

const seedPhones: Record<string, string> = {
  "agent-1": "+51 987 654 321",
  "agent-2": "+51 923 456 789",
  "agent-3": "+51 912 345 678",
};

type LegacyAgent = Agent & {
  role?: string;
  username?: string;
  password?: string;
};

type AgentProfileLike = Partial<Agent> & { id: string };

function normalizeAgent(agent: LegacyAgent): Agent {
  const roleId =
    agent.roleId ??
    (agent.role === "admin" ? SYSTEM_ROLE_IDS.admin : SYSTEM_ROLE_IDS.agent);

  return {
    id: agent.id,
    name: agent.name,
    username: agent.username || deriveUsernameFromName(agent.name, agent.id),
    password: agent.password || DEFAULT_PASSWORD,
    phone: agent.phone || seedPhones[agent.id] || undefined,
    email: agent.email,
    avatar: agent.avatar,
    status: agent.status,
    roleId,
    roleName: agent.roleName,
    permissions: agent.permissions,
    active: agent.active ?? true,
  };
}

function loadAgents(): Agent[] {
  if (typeof window === "undefined") {
    return seedAgents.map(normalizeAgent);
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as LegacyAgent[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeAgent);
      }
    }
  } catch {
    // ignore invalid storage
  }

  return seedAgents.map(normalizeAgent);
}

function saveAgents(agents: Agent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export interface InviteAgentInput {
  name: string;
  username: string;
  password: string;
  roleId: string;
  phone?: string;
}

interface AgentState {
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  inviteAgent: (input: InviteAgentInput) => Promise<Agent | null>;
  updateAgent: (
    id: string,
    patch: Partial<
      Pick<Agent, "name" | "username" | "password" | "phone" | "roleId" | "active" | "status">
    >
  ) => Promise<boolean>;
  removeAgent: (id: string) => Promise<boolean>;
  getAgentById: (id: string) => Agent | undefined;
  getAgentByUsername: (username: string) => Agent | undefined;
  getActiveAgents: () => Agent[];
  countByRoleId: (roleId: string) => number;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: env.useMock ? loadAgents() : [],

  setAgents: (agents) => set({ agents }),

  inviteAgent: async ({ name, username, password, roleId, phone }) => {
    const trimmedName = name.trim();
    const normalizedUsername = normalizeUsername(username);
    const normalizedPhone = phone
      ? normalizeAgentPhone(phone, { optional: true })
      : "";

    if (
      !trimmedName ||
      !roleId ||
      !isValidUsername(normalizedUsername) ||
      !isValidPassword(password) ||
      normalizedPhone === null
    ) {
      return null;
    }

    const agents = get().agents;
    if (
      agents.some(
        (agent) => agent.name.trim().toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      return null;
    }

    if (
      agents.some(
        (agent) => normalizeUsername(agent.username) === normalizedUsername
      )
    ) {
      return null;
    }

    if (
      normalizedPhone &&
      agents.some((agent) => agent.phone && agent.phone === normalizedPhone)
    ) {
      return null;
    }

    if (!env.useMock) {
      try {
        const created = await agentApiService.create({
          name: trimmedName,
          username: normalizedUsername,
          password,
          roleId,
          phone: normalizedPhone || undefined,
        });
        set({ agents: [...agents, created] });
        return created;
      } catch {
        return null;
      }
    }

    const agent: Agent = normalizeAgent({
      id: `agent-${Date.now()}`,
      name: trimmedName,
      username: normalizedUsername,
      password,
      phone: normalizedPhone || undefined,
      avatar: getInitials(trimmedName),
      status: "offline",
      roleId,
      active: true,
    });

    const nextAgents = [...agents, agent];
    saveAgents(nextAgents);
    set({ agents: nextAgents });
    return agent;
  },

  updateAgent: async (id, patch) => {
    const nextPatch = { ...patch };

    if (nextPatch.username !== undefined) {
      const normalizedUsername = normalizeUsername(nextPatch.username);
      if (!isValidUsername(normalizedUsername)) return false;
      const duplicate = get().agents.some(
        (agent) =>
          agent.id !== id &&
          normalizeUsername(agent.username) === normalizedUsername
      );
      if (duplicate) return false;
      nextPatch.username = normalizedUsername;
    }

    if (nextPatch.password !== undefined && !isValidPassword(nextPatch.password)) {
      return false;
    }

    if (nextPatch.phone !== undefined) {
      const normalizedPhone = normalizeAgentPhone(nextPatch.phone, { optional: true });
      if (normalizedPhone === null) return false;
      if (normalizedPhone) {
        const duplicate = get().agents.some(
          (agent) => agent.id !== id && agent.phone === normalizedPhone
        );
        if (duplicate) return false;
      }
      nextPatch.phone = normalizedPhone || undefined;
    }

    if (!env.useMock) {
      try {
        const updated = await agentApiService.update(id, {
          name: nextPatch.name,
          username: nextPatch.username,
          password: nextPatch.password,
          phone: nextPatch.phone,
          roleId: nextPatch.roleId,
          active: nextPatch.active,
          status: nextPatch.status,
        });
        const role = useRoleStore.getState().getRoleById(updated.roleId);
        const merged = {
          ...updated,
          roleName: role?.name ?? updated.roleName,
          permissions: role?.permissions ?? updated.permissions,
        };
        set({
          agents: get().agents.map((agent) => (agent.id === id ? merged : agent)),
        });
        return true;
      } catch {
        return false;
      }
    }

    const agents = get().agents.map((agent) =>
      agent.id === id ? normalizeAgent({ ...agent, ...nextPatch }) : agent
    );
    saveAgents(agents);
    set({ agents });
    return true;
  },

  removeAgent: async (id) => {
    const { agents } = get();
    const target = agents.find((agent) => agent.id === id);
    if (!target) return false;

    if (target.username === PROTECTED_AGENT_USERNAME) return false;

    const adminCount = agents.filter(
      (agent) =>
        agent.roleId === SYSTEM_ROLE_IDS.admin && agent.active !== false
    ).length;
    if (target.roleId === SYSTEM_ROLE_IDS.admin && adminCount <= 1) return false;

    if (!env.useMock) {
      try {
        await agentApiService.remove(id);
      } catch {
        return false;
      }
    }

    const nextAgents = agents.filter((agent) => agent.id !== id);
    if (env.useMock) {
      saveAgents(nextAgents);
    }
    set({ agents: nextAgents });
    useInboxSettingsStore.getState().removeAgentFromAllInboxes(id);
    return true;
  },

  getAgentById: (id) => get().agents.find((agent) => agent.id === id),

  getAgentByUsername: (username) => {
    const normalized = normalizeUsername(username);
    return get().agents.find(
      (agent) => normalizeUsername(agent.username) === normalized
    );
  },

  getActiveAgents: () => get().agents.filter((agent) => agent.active !== false),

  countByRoleId: (roleId) =>
    get().agents.filter((agent) => agent.roleId === roleId).length,
}));

/** Fusiona el perfil de /auth/me o login (incluye permissions) en el store. */
export function mergeAgentProfile(profile: AgentProfileLike): void {
  const { agents, setAgents } = useAgentStore.getState();
  const existing = agents.find((agent) => agent.id === profile.id);

  if (!existing) {
    setAgents([...agents, normalizeAgent(profile as LegacyAgent)]);
    return;
  }

  setAgents(
    agents.map((agent) =>
      agent.id === profile.id
        ? normalizeAgent({ ...agent, ...profile })
        : agent
    )
  );
}

export function getAgentDisplayPhone(agent: Agent): string {
  return agent.phone || "—";
}
