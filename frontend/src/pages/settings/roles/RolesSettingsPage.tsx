import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CreateRoleModal } from "@/components/settings/CreateRoleModal";
import { RoleSettingsModal } from "@/components/settings/RoleSettingsModal";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/store/agentStore";
import { useRoleStore } from "@/store/roleStore";
import { useUIStore } from "@/store/uiStore";
import type { AgentPermissions, Role } from "@/types";

export function RolesSettingsPage() {
  const showToast = useUIStore((s) => s.showToast);
  const roles = useRoleStore((s) => s.roles);
  const addRole = useRoleStore((s) => s.addRole);
  const updateRole = useRoleStore((s) => s.updateRole);
  const removeRole = useRoleStore((s) => s.removeRole);
  const agents = useAgentStore((s) => s.agents);

  const [createOpen, setCreateOpen] = useState(false);
  const [settingsRole, setSettingsRole] = useState<Role | null>(null);

  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const role of roles) {
      counts[role.id] = agents.filter((agent) => agent.roleId === role.id).length;
    }
    return counts;
  }, [roles, agents]);

  const handleCreate = (name: string) => {
    const created = addRole(name);
    if (!created) return false;
    showToast(`Rol "${created.name}" creado`);
    setSettingsRole(created);
    return true;
  };

  const handleSaveRole = (id: string, data: { name: string; permissions: AgentPermissions }) => {
    updateRole(id, data);
    showToast("Rol actualizado");
  };

  const handleRemoveRole = (id: string) => {
    const count = agentCounts[id] ?? 0;
    if (count > 0) return false;
    const ok = removeRole(id);
    if (ok) showToast("Rol eliminado");
    return ok;
  };

  return (
    <>
      <SettingsSection
        title={`Roles (${roles.length})`}
        description="Plantillas de permisos reutilizables. Los agentes heredan lo definido aquí."
        action={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-8 px-3 text-xs font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo rol
          </button>
        }
      >
        <div className="divide-y divide-[var(--color-border-primary)] -mx-4 -mb-4">
          {roles.map((role) => (
            <div
              key={role.id}
              className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px_72px] gap-3 items-center px-4 py-3 hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {role.name}
                  </p>
                  {role.isSystem && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] shrink-0">
                      Sistema
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--color-text-muted)] sm:hidden">
                  {agentCounts[role.id] ?? 0} agente{(agentCounts[role.id] ?? 0) === 1 ? "" : "s"}
                </p>
              </div>

              <p className="text-sm text-[var(--color-text-secondary)] hidden sm:block">
                {agentCounts[role.id] ?? 0} agente{(agentCounts[role.id] ?? 0) === 1 ? "" : "s"}
              </p>

              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setSettingsRole(role)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                  title="Editar rol"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveRole(role.id)}
                  disabled={role.isSystem || (agentCounts[role.id] ?? 0) > 0}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-lg border transition-colors",
                    role.isSystem || (agentCounts[role.id] ?? 0) > 0
                      ? "border-[var(--color-border-primary)] text-[var(--color-text-muted)]/40 cursor-not-allowed"
                      : "border-[var(--color-border-primary)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                  )}
                  title="Eliminar rol"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <CreateRoleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <RoleSettingsModal
        role={settingsRole}
        open={settingsRole !== null}
        agentCount={settingsRole ? agentCounts[settingsRole.id] ?? 0 : 0}
        onClose={() => setSettingsRole(null)}
        onSave={handleSaveRole}
        onRemove={handleRemoveRole}
      />
    </>
  );
}
