import { useEffect, useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AgentPhoneField } from "@/components/settings/AgentPhoneField";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { SettingsToggle } from "@/components/settings/SettingsModal";
import {
  getUsernameValidationError,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
} from "@/lib/agentCredentials";
import { isValidAgentPhoneInput, phoneToInputValue } from "@/lib/agentPhone";
import { cn } from "@/lib/utils";
import { PROTECTED_AGENT_USERNAME } from "@/services/agentApiService";
import { useInboxStore } from "@/store/inboxStore";
import { useRoleStore } from "@/store/roleStore";
import type { Agent } from "@/types";
import {
  Camera,
  Check,
  Globe,
  Mail,
  MessageCircle,
  MessageCircleMore,
} from "lucide-react";

const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  email: Mail,
  facebook: MessageCircleMore,
  instagram: Camera,
  website: Globe,
};

const channelColors: Record<string, string> = {
  whatsapp: "text-emerald-400",
  email: "text-blue-400",
  facebook: "text-blue-500",
  instagram: "text-pink-400",
  website: "text-violet-400",
};

interface AgentSettingsModalProps {
  agent: Agent | null;
  open: boolean;
  assignedInboxIds: string[];
  onClose: () => void;
  onSave: (
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
  ) => boolean | Promise<boolean>;
  onRemove: (id: string) => boolean | Promise<boolean>;
}

export function AgentSettingsModal({
  agent,
  open,
  assignedInboxIds,
  onClose,
  onSave,
  onRemove,
}: AgentSettingsModalProps) {
  const inboxes = useInboxStore((s) => s.inboxes);
  const roles = useRoleStore((s) => s.roles);
  const getRoleName = useRoleStore((s) => s.getRoleName);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [active, setActive] = useState(true);
  const [selectedInboxIds, setSelectedInboxIds] = useState<string[]>([]);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) return;
    setName(agent.name);
    setUsername(agent.username);
    setPassword("");
    setShowPassword(false);
    setPhone(phoneToInputValue(agent.phone || ""));
    setRoleId(agent.roleId);
    setActive(agent.active !== false);
    setSelectedInboxIds(assignedInboxIds);
    setRemoveError(null);
  }, [agent, assignedInboxIds]);

  if (!agent) return null;

  const isProtected = agent.username === PROTECTED_AGENT_USERNAME;
  const selectedRole = roles.find((role) => role.id === roleId);

  const toggleInbox = (inboxId: string) => {
    setSelectedInboxIds((prev) =>
      prev.includes(inboxId) ? prev.filter((id) => id !== inboxId) : [...prev, inboxId]
    );
  };

  const handleSave = async () => {
    if (
      !name.trim() ||
      !roleId ||
      !isValidUsername(username) ||
      !isValidAgentPhoneInput(phone, { optional: true }) ||
      (password.trim() && !isValidPassword(password))
    ) {
      return;
    }

    const ok = await onSave(agent.id, {
      name: name.trim(),
      username: normalizeUsername(username),
      password: password.trim() || undefined,
      phone,
      roleId,
      active,
      inboxIds: selectedInboxIds,
    });
    if (ok === false) return;
    onClose();
  };

  const handleRemove = async () => {
    const ok = await onRemove(agent.id);
    if (!ok) {
      setRemoveError("No se puede eliminar al último administrador ni a tu propia cuenta.");
      return;
    }
    onClose();
  };

  return (
    <SettingsModal
      open={open}
      onClose={onClose}
      title="Configurar agente"
      description={`${getRoleName(roleId)} · ${formatInboxSummary(selectedInboxIds.length)}`}
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
            disabled={
              !name.trim() ||
              !roleId ||
              !isValidUsername(username) ||
              !isValidAgentPhoneInput(phone, { optional: true }) ||
              Boolean(password.trim() && !isValidPassword(password))
            }
            className={cn(
              "h-9 px-4 text-sm font-medium rounded-lg transition-colors",
              name.trim() &&
                roleId &&
                isValidUsername(username) &&
                isValidAgentPhoneInput(phone, { optional: true }) &&
                (!password.trim() || isValidPassword(password))
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
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border-primary)]">
          <Avatar name={name || agent.name} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {name || agent.name}
            </p>
            <p className="text-[12px] text-[var(--color-text-muted)]">
              {getRoleName(roleId)} · {formatInboxSummary(selectedInboxIds.length)}
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Información</h4>
          <label className="block">
            <span className="text-[13px] text-[var(--color-text-secondary)] mb-1.5 block">Nombre</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-[var(--color-text-secondary)] mb-1.5 block">Usuario</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              className={inputClass}
            />
            {username && getUsernameValidationError(username) && (
              <p className="text-[11px] text-[var(--color-danger)] mt-1">
                {getUsernameValidationError(username)}
              </p>
            )}
          </label>
          <label className="block">
            <span className="text-[13px] text-[var(--color-text-secondary)] mb-1.5 block">
              Nueva contraseña
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Dejar vacío para no cambiar"
                autoComplete="new-password"
                className={cn(inputClass, "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="text-[13px] text-[var(--color-text-secondary)] mb-1.5 block">
              Número de teléfono (opcional)
            </span>
            <AgentPhoneField value={phone} required={false} onChange={setPhone} />
          </label>
        </section>

        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Rol</h4>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Los permisos vienen del rol. Edítalos en Ajustes → Roles.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                disabled={isProtected && role.id !== "role-admin"}
                onClick={() => setRoleId(role.id)}
                className={cn(
                  "px-3 py-2.5 rounded-lg border text-left transition-colors",
                  roleId === role.id
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-bg)]"
                    : "border-[var(--color-border-primary)] hover:bg-[var(--color-bg-hover)]",
                  isProtected && role.id !== "role-admin" && "opacity-50 cursor-not-allowed"
                )}
              >
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{role.name}</p>
              </button>
            ))}
          </div>
          {selectedRole && (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Permisos heredados de <span className="text-[var(--color-text-secondary)]">{selectedRole.name}</span>.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Bandejas</h4>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Bandejas a las que puede acceder este agente.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-border-primary)] divide-y divide-[var(--color-border-primary)]">
            {inboxes.map((inbox) => {
              const selected = selectedInboxIds.includes(inbox.id);
              const Icon = channelIcons[inbox.channelType] || Globe;
              return (
                <button
                  key={inbox.id}
                  type="button"
                  onClick={() => toggleInbox(inbox.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <Icon className={cn("w-4 h-4 shrink-0", channelColors[inbox.channelType])} />
                  <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">
                    {inbox.name}
                  </span>
                  <span
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                      selected
                        ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-white"
                        : "border-[var(--color-border-secondary)]"
                    )}
                  >
                    {selected && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3 pt-2 border-t border-[var(--color-border-primary)]">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Estado</h4>
          <SettingsToggle
            checked={active}
            onChange={setActive}
            disabled={isProtected}
            label="Agente activo"
            description="Los agentes inactivos no pueden iniciar sesión ni recibir asignaciones."
          />
        </section>

        {!isProtected && (
          <section className="space-y-3 pt-2 border-t border-[var(--color-border-primary)]">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Zona de riesgo</h4>
            {removeError && <p className="text-xs text-[var(--color-danger)]">{removeError}</p>}
            <button
              type="button"
              onClick={handleRemove}
              className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar agente
            </button>
          </section>
        )}
      </div>
    </SettingsModal>
  );
}

const inputClass =
  "w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2.5 outline-none border border-[var(--color-border-primary)] focus:border-[var(--color-brand)] transition-colors";

function formatInboxSummary(count: number) {
  if (count === 0) return "sin bandejas asignadas";
  if (count === 1) return "1 bandeja asignada";
  return `${count} bandejas asignadas`;
}
