import { apiRequest } from "@/api/client";
import type { AgentProfileDto } from "@/types/api";
import type { InviteAgentInput } from "@/store/agentStore";
import type { Agent } from "@/types";

export const PROTECTED_AGENT_USERNAME = "soporte";

function toAgent(profile: AgentProfileDto): Agent {
  return { ...profile };
}

export const agentApiService = {
  async list(): Promise<Agent[]> {
    const rows = await apiRequest<AgentProfileDto[]>("/agents");
    return rows.map(toAgent);
  },

  async create(input: InviteAgentInput): Promise<Agent> {
    const row = await apiRequest<AgentProfileDto>("/agents", {
      method: "POST",
      body: input,
    });
    return toAgent(row);
  },

  async update(
    id: string,
    patch: Partial<
      Pick<Agent, "name" | "username" | "phone" | "roleId" | "active" | "status"> & {
        password?: string;
        inboxIds?: string[];
      }
    >
  ): Promise<Agent> {
    const row = await apiRequest<AgentProfileDto>(`/agents/${id}`, {
      method: "PATCH",
      body: patch,
    });
    return toAgent(row);
  },

  async remove(id: string): Promise<void> {
    await apiRequest(`/agents/${id}`, { method: "DELETE" });
  },
};
