import { create } from "zustand";
import { apiRequest, getAccessToken, setAccessToken, setForbiddenHandler, setUnauthorizedHandler, type UnauthorizedReason } from "@/api/client";
import { env } from "@/config/env";
import { authService } from "@/services/authService";
import { mergeAgentProfile, useAgentStore } from "@/store/agentStore";
import { useUIStore } from "@/store/uiStore";
import type { Agent, AgentProfile } from "@/types";

const AUTH_STORAGE_KEY = "chatpool-auth";
const AUTH_AGENT_KEY = "chatpool-auth-agent";

async function clearActiveConversationOnLogout(agentId: string | null): Promise<void> {
  const { clearActiveConversation } = await import("@/lib/activeConversationSession");
  const { useConversationStore } = await import("@/store/conversationStore");
  if (agentId) clearActiveConversation(agentId);
  useConversationStore.getState().clearActiveConversationSelection();
}

interface AuthState {
  isAuthenticated: boolean;
  agentId: string | null;
  rememberMe: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  forceLogout: (reason: UnauthorizedReason, message?: string) => void;
  validateSession: () => Promise<boolean>;
  getCurrentAgent: () => Agent | undefined;
  getCurrentAgentProfile: () => AgentProfile | undefined;
}

function readStoredAuth(): { active: boolean; agentId: string | null } {
  if (typeof window === "undefined") {
    return { active: false, agentId: null };
  }

  return {
    active: localStorage.getItem(AUTH_STORAGE_KEY) === "true",
    agentId: localStorage.getItem(AUTH_AGENT_KEY),
  };
}

function persistAuth(active: boolean, agentId: string | null) {
  if (active && agentId) {
    localStorage.setItem(AUTH_STORAGE_KEY, "true");
    localStorage.setItem(AUTH_AGENT_KEY, agentId);
    return;
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_AGENT_KEY);
}

const storedAuth = readStoredAuth();

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: storedAuth.active,
  agentId: storedAuth.agentId,
  rememberMe: false,

  login: async (username, password, rememberMe = false) => {
    const response = await authService.login({ username, password });
    if (!response) return false;

    setAccessToken(response.accessToken);
    mergeAgentProfile(response.agent);
    persistAuth(true, response.agent.id);
    set({ isAuthenticated: true, agentId: response.agent.id, rememberMe });
    return true;
  },

  logout: async () => {
    if (!env.useMock && getAccessToken()) {
      try {
        await apiRequest("/auth/logout", { method: "POST" });
      } catch {
        // ignore network errors on logout
      }
    }

    authService.logout();
    const agentId = get().agentId;
    persistAuth(false, null);
    void clearActiveConversationOnLogout(agentId);
    set({ isAuthenticated: false, agentId: null, rememberMe: false });
  },

  forceLogout: (reason, message) => {
    if (!get().isAuthenticated && !getAccessToken()) return;

    const agentId = get().agentId;
    authService.logout();
    persistAuth(false, null);
    void clearActiveConversationOnLogout(agentId);
    set({ isAuthenticated: false, agentId: null, rememberMe: false });

    const defaultMessage =
      reason === "SESSION_REVOKED"
        ? "Sesión cerrada: iniciaste sesión en otro dispositivo o cerraste sesión"
        : reason === "SESSION_EXPIRED"
          ? "Tu sesión expiró. Vuelve a iniciar sesión."
          : "Tu sesión ya no es válida. Vuelve a iniciar sesión.";

    useUIStore.getState().showToast(message ?? defaultMessage);
  },

  validateSession: async () => {
    if (env.useMock) {
      const { agentId, isAuthenticated } = get();
      if (!isAuthenticated || !agentId) return false;
      return Boolean(useAgentStore.getState().getAgentById(agentId));
    }

    if (!getAccessToken()) {
      get().forceLogout("SESSION_EXPIRED");
      return false;
    }

    const profile = await authService.getMe();
    if (!profile) {
      get().forceLogout("SESSION_EXPIRED");
      return false;
    }

    mergeAgentProfile(profile);
    persistAuth(true, profile.id);
    set({ isAuthenticated: true, agentId: profile.id });
    return true;
  },

  getCurrentAgent: () => {
    const { agentId } = get();
    if (!agentId) return undefined;
    return useAgentStore.getState().getAgentById(agentId);
  },

  getCurrentAgentProfile: () => {
    const agent = get().getCurrentAgent();
    if (!agent) return undefined;
    const { password: _password, ...profile } = agent;
    return profile;
  },
}));

export function registerAuthUnauthorizedHandler() {
  setUnauthorizedHandler((reason, message) => {
    useAuthStore.getState().forceLogout(reason, message);
  });

  setForbiddenHandler((message) => {
    useUIStore.getState().showToast(message);
  });
}
