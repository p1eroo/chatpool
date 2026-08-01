import { useAuthStore } from "@/store/authStore";

/** Agente autenticado actual (reactivo). */
export function useCurrentAgent() {
  const agentId = useAuthStore((s) => s.agentId);
  return useAuthStore((s) => (agentId ? s.getCurrentAgent() : undefined));
}

export { getCurrentAgentId } from "@/lib/authSession";
