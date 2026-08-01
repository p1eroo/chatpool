import { apiRequest, setAccessToken } from "@/api/client";
import { env } from "@/config/env";
import { normalizeUsername } from "@/lib/agentCredentials";
import { useAgentStore } from "@/store/agentStore";
import type { AgentProfileDto, LoginRequest, LoginResponse } from "@/types/api";
import type { Agent } from "@/types";

function toAgentProfile(agent: Agent): AgentProfileDto {
  const { password: _password, ...profile } = agent;
  return profile;
}

function mockLogin(credentials: LoginRequest): LoginResponse | null {
  const normalizedUsername = normalizeUsername(credentials.username);
  const agent = useAgentStore
    .getState()
    .agents.find(
      (item) =>
        item.active !== false &&
        normalizeUsername(item.username) === normalizedUsername &&
        item.password === credentials.password
    );

  if (!agent) return null;

  return {
    accessToken: `mock-token-${agent.id}`,
    agent: toAgentProfile(agent),
  };
}

async function httpLogin(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: credentials,
    auth: false,
  });
  setAccessToken(response.accessToken);
  return response;
}

export const authService = {
  /** Login síncrono en modo mock (formulario actual). */
  loginSync(credentials: LoginRequest): LoginResponse | null {
    if (!env.useMock) {
      console.warn("loginSync solo en mock; usa login() con VITE_USE_MOCK=false");
      return null;
    }
    return mockLogin(credentials);
  },

  async login(credentials: LoginRequest): Promise<LoginResponse | null> {
    if (env.useMock) {
      return mockLogin(credentials);
    }
    try {
      return await httpLogin(credentials);
    } catch {
      return null;
    }
  },

  async getMe(): Promise<AgentProfileDto | null> {
    if (env.useMock) {
      const agentId = localStorage.getItem("chatpool-auth-agent");
      if (!agentId) return null;
      const agent = useAgentStore.getState().getAgentById(agentId);
      return agent ? toAgentProfile(agent) : null;
    }

    try {
      return await apiRequest<AgentProfileDto>("/auth/me", { notifyUnauthorized: false });
    } catch {
      return null;
    }
  },

  logout() {
    setAccessToken(null);
  },
};

export function stripAgentCredentials(agent: Agent): AgentProfileDto {
  return toAgentProfile(agent);
}
