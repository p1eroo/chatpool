import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { SettingsModal, SettingsToggle } from "@/components/settings/SettingsModal";
import { PERMISSION_GROUPS } from "@/lib/agentPermissions";
import { cn } from "@/lib/utils";
import type { AgentPermissions, Role } from "@/types";

interface RoleSettingsModalProps {
  role: Role | null;
  open: boolean;
  agentCount: number;
  onClose: () => void;
  onSave: (id: string, data: { name: string; permissions: AgentPermissions }) => void;
  onRemove: (id: string) => boolean | Promise<boolean>;
}

export function RoleSettingsModal({
  role,
  open,
  agentCount,
  onClose,
  onSave,
  onRemove,
}: RoleSettingsModalProps) {
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<AgentPermissions>(
    role?.permissions ?? ({} as AgentPermissions)
  );
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;
    setName(role.name);
    setPermissions(role.permissions);
    setRemoveError(null);
  }, [role]);

  if (!role) return null;

  const isAdminRole = role.id === "role-admin";

  const handlePermissionChange = (key: keyof AgentPermissions, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(role.id, {
      name: name.trim(),
      permissions: isAdminRole ? role.permissions : permissions,
    });
    onClose();
  };

  const handleRemove = async () => {
    const ok = await onRemove(role.id);
    if (!ok) {
      setRemoveError(
        role.isSystem
          ? "Los roles del sistema no se pueden eliminar."
          : "No se puede eliminar un rol que aún tiene agentes asignados."
      );
      return;
    }
    onClose();
  };

  return (
    <SettingsModal
      open={open}
      onClose={onClose}
      title={role.isSystem ? "Editar rol del sistema" : "Editar rol"}
      description={`${agentCount} agente${agentCount === 1 ? "" : "s"} con este rol`}
      wide
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className={cn(
              "h-9 px-4 text-sm font-medium rounded-lg transition-colors",
              name.trim()
                ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)]"
                : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed"
            )}
          >
            Guardar cambios
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Nombre del rol</h4>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={role.isSystem}
            className={cn(inputClass, role.isSystem && "opacity-70 cursor-not-allowed")}
          />
          {role.isSystem && (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Los roles del sistema no se pueden renombrar.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Permisos</h4>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Los agentes con este rol heredan estos permisos automáticamente.
            </p>
          </div>
          {isAdminRole && (
            <p className="text-[11px] text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border-primary)] px-3 py-2">
              El administrador tiene acceso completo y no se puede restringir.
            </p>
          )}
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                {group.title}
              </p>
              <div className="rounded-lg border border-[var(--color-border-primary)] divide-y divide-[var(--color-border-primary)] px-3">
                {group.items.map((item) => (
                  <SettingsToggle
                    key={item.key}
                    checked={permissions[item.key]}
                    onChange={(value) => handlePermissionChange(item.key, value)}
                    disabled={isAdminRole}
                    label={item.label}
                    description={item.description}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>

        {!role.isSystem && (
          <section className="space-y-3 pt-2 border-t border-[var(--color-border-primary)]">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Zona de riesgo</h4>
            {removeError && <p className="text-xs text-[var(--color-danger)]">{removeError}</p>}
            <button
              type="button"
              onClick={handleRemove}
              disabled={agentCount > 0}
              className={cn(
                "h-9 px-4 text-sm font-medium rounded-lg border transition-colors flex items-center gap-1.5",
                agentCount > 0
                  ? "border-[var(--color-border-primary)] text-[var(--color-text-muted)] cursor-not-allowed"
                  : "border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white"
              )}
            >
              <Trash2 className="w-4 h-4" />
              Eliminar rol
            </button>
          </section>
        )}
      </div>
    </SettingsModal>
  );
}

const inputClass =
  "w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2.5 outline-none border border-[var(--color-border-primary)] focus:border-[var(--color-brand)] transition-colors";
