import { useAuthStore } from "@/store/authStore";

/** ID del agente autenticado (usable fuera de React). */
export function getCurrentAgentId(): string | undefined {
  return useAuthStore.getState().agentId ?? undefined;
}
