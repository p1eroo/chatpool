import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusDot } from "@/components/ui/StatusDot";
import { AgentSettingsModal } from "@/components/settings/AgentSettingsModal";
import { InviteAgentModal } from "@/components/settings/InviteAgentModal";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { formatInboxCount } from "@/lib/agentInboxes";
import { cn } from "@/lib/utils";
import { PROTECTED_AGENT_USERNAME } from "@/services/agentApiService";
import { useAgentStore } from "@/store/agentStore";
import type { InviteAgentInput } from "@/store/agentStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { useRoleStore } from "@/store/roleStore";
import { useUIStore } from "@/store/uiStore";
import type { Agent } from "@/types";

export function AgentsSettingsPage() {
  const showToast = useUIStore((s) => s.showToast);
  const agents = useAgentStore((s) => s.agents);
  const inviteAgent = useAgentStore((s) => s.inviteAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const settings = useInboxSettingsStore((s) => s.settings);
  const getInboxIdsForAgent = useInboxSettingsStore((s) => s.getInboxIdsForAgent);
  const setAgentInboxAccess = useInboxSettingsStore((s) => s.setAgentInboxAccess);
  const getRoleName = useRoleStore((s) => s.getRoleName);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsAgent, setSettingsAgent] = useState<Agent | null>(null);

  const inboxCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const agent of agents) {
      counts[agent.id] = settings.filter((item) =>
        item.assignedAgentIds.includes(agent.id)
      ).length;
    }
    return counts;
  }, [agents, settings]);

  const assignedInboxIds = settingsAgent ? getInboxIdsForAgent(settingsAgent.id) : [];

  const handleInvite = async (input: InviteAgentInput) => {
    const created = await inviteAgent(input);
    if (!created) return false;
    showToast(`${created.name} añadido al equipo`);
    return true;
  };

  const handleSaveAgent = async (
    id: string,
    data: {
      name: string;
      username: string;
      password?: string;
      phone: string;
      roleId: string;
      active: boolean;
      inboxIds: string[];
    }
  ) => {
    const ok = await updateAgent(id, {
      name: data.name,
      username: data.username,
      ...(data.password ? { password: data.password } : {}),
      phone: data.phone,
      roleId: data.roleId,
      active: data.active,
      inboxIds: data.inboxIds,
    });
    if (!ok) {
      showToast("No se pudo guardar. Revisa usuario, teléfono o contraseña.");
      return false;
    }
    setAgentInboxAccess(id, data.inboxIds);
    showToast("Agente actualizado");
    return true;
  };

  const handleRemoveAgent = async (id: string) => {
    const ok = await removeAgent(id);
    if (ok) showToast("Agente eliminado");
    return ok;
  };

  const handleQuickRemove = async (agent: Agent) => {
    const ok = await removeAgent(agent.id);
    if (ok) {
      showToast(`${agent.name} eliminado`);
    } else {
      showToast("No se puede eliminar este agente");
    }
  };

  return (
    <>
      <SettingsSection
        title={`Agentes (${agents.length})`}
        description="Asigna rol y bandejas a cada miembro. Los permisos se definen en Roles."
        action={
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="h-8 px-3 text-xs font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo
          </button>
        }
      >
        <div className="divide-y divide-[var(--color-border-primary)] -mx-4 -mb-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={cn(
                "grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_140px_110px_110px_72px] gap-3 items-center px-4 py-3 hover:bg-[var(--color-bg-hover)] transition-colors",
                agent.active === false && "opacity-60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <Avatar name={agent.name} size="md" />
                  <StatusDot
                    status={agent.status}
                    className="absolute -bottom-0.5 -right-0.5 !border-[var(--color-bg-secondary)]"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {agent.name}
                    </p>
                    {agent.active === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)] shrink-0 sm:hidden">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--color-text-muted)] sm:hidden">
                    @{agent.username} · {getRoleName(agent.roleId)} ·{" "}
                    {formatInboxCount(inboxCounts[agent.id] ?? 0)}
                  </p>
                </div>
              </div>

              <p className="text-sm text-[var(--color-text-secondary)] hidden sm:block truncate">
                @{agent.username}
              </p>

              <p className="text-sm text-[var(--color-text-secondary)] hidden sm:block">
                {getRoleName(agent.roleId)}
              </p>

              <p className="text-sm text-[var(--color-text-secondary)] hidden sm:block">
                {formatInboxCount(inboxCounts[agent.id] ?? 0)}
              </p>

              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setSettingsAgent(agent)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                  title="Editar agente"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickRemove(agent)}
                  disabled={agent.username === PROTECTED_AGENT_USERNAME}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-lg border transition-colors",
                    agent.username === PROTECTED_AGENT_USERNAME
                      ? "border-[var(--color-border-primary)] text-[var(--color-text-muted)]/40 cursor-not-allowed"
                      : "border-[var(--color-border-primary)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                  )}
                  title="Eliminar agente"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <InviteAgentModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
      />

      <AgentSettingsModal
        agent={settingsAgent}
        open={settingsAgent !== null}
        assignedInboxIds={assignedInboxIds}
        onClose={() => setSettingsAgent(null)}
        onSave={handleSaveAgent}
        onRemove={handleRemoveAgent}
      />
    </>
  );
}
