import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { AgentPhoneField } from "@/components/settings/AgentPhoneField";
import {
  getPasswordValidationError,
  getUsernameValidationError,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
} from "@/lib/agentCredentials";
import { isValidAgentPhoneInput } from "@/lib/agentPhone";
import { cn } from "@/lib/utils";
import { useRoleStore } from "@/store/roleStore";
import type { InviteAgentInput } from "@/store/agentStore";

interface InviteAgentModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (input: InviteAgentInput) => boolean | Promise<boolean>;
}

export function InviteAgentModal({ open, onClose, onInvite }: InviteAgentModalProps) {
  const roles = useRoleStore((s) => s.roles);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("role-agent");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneValid = isValidAgentPhoneInput(phone, { optional: true });
  const canSubmit =
    name.trim().length > 0 &&
    isValidUsername(username) &&
    isValidPassword(password) &&
    phoneValid &&
    Boolean(roleId);

  const reset = () => {
    setName("");
    setUsername("");
    setPassword("");
    setPhone("");
    setRoleId("role-agent");
    setShowPassword(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const ok = await onInvite({
      name: name.trim(),
      username: normalizeUsername(username),
      password,
      roleId,
      phone: phone.trim() ? phone : undefined,
    });

    if (!ok) {
      setError("Revisa los datos o si el usuario ya existe.");
      return;
    }

    reset();
    onClose();
  };

  return (
    <SettingsModal
      open={open}
      onClose={handleClose}
      title="Nuevo agente"
      description="Añade un miembro al equipo y asígnale un rol."
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "h-9 px-4 text-sm font-medium rounded-lg transition-colors",
              canSubmit
                ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)]"
                : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed"
            )}
          >
            Crear agente
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Nombre completo">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Ej. María González"
            className={inputClass}
            autoFocus
          />
        </FormField>

        <FormField label="Usuario">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            placeholder="Ej. maria.gonzalez"
            autoComplete="off"
            className={inputClass}
          />
          {username && getUsernameValidationError(username) && (
            <p className="text-[11px] text-[var(--color-danger)] mt-1">
              {getUsernameValidationError(username)}
            </p>
          )}
        </FormField>

        <FormField label="Contraseña">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className={cn(inputClass, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && getPasswordValidationError(password) && (
            <p className="text-[11px] text-[var(--color-danger)] mt-1">
              {getPasswordValidationError(password)}
            </p>
          )}
        </FormField>

        <FormField label="Número de teléfono (opcional)">
          <AgentPhoneField
            value={phone}
            required={false}
            onChange={(value) => {
              setPhone(value);
              setError(null);
            }}
          />
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Podrá usarse más adelante para recuperar la contraseña.
          </p>
        </FormField>

        <FormField label="Rol">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setRoleId(role.id)}
                className={cn(
                  "px-3 py-2.5 rounded-lg border text-left transition-colors",
                  roleId === role.id
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-bg)]"
                    : "border-[var(--color-border-primary)] hover:bg-[var(--color-bg-hover)]"
                )}
              >
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{role.name}</p>
              </button>
            ))}
          </div>
        </FormField>

        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    </SettingsModal>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] text-[var(--color-text-secondary)] mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2.5 outline-none border border-[var(--color-border-primary)] focus:border-[var(--color-brand)] transition-colors placeholder:text-[var(--color-text-muted)]";
