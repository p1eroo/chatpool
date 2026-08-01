import { useState } from "react";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { cn } from "@/lib/utils";

interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => boolean;
}

export function CreateRoleModal({ open, onClose, onCreate }: CreateRoleModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    const ok = onCreate(name);
    if (!ok) {
      setError("Revisa el nombre o si el rol ya existe.");
      return;
    }
    reset();
    onClose();
  };

  return (
    <SettingsModal
      open={open}
      onClose={handleClose}
      title="Nuevo rol"
      description="Define un rol con permisos propios. Luego asígnalo a los agentes."
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
            disabled={!name.trim()}
            className={cn(
              "h-9 px-4 text-sm font-medium rounded-lg transition-colors",
              name.trim()
                ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)]"
                : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed"
            )}
          >
            Crear rol
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-[13px] text-[var(--color-text-secondary)] mb-1.5 block">
            Nombre del rol
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Ej. Supervisor, Soporte nivel 2"
            className={inputClass}
            autoFocus
          />
        </label>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    </SettingsModal>
  );
}

const inputClass =
  "w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2.5 outline-none border border-[var(--color-border-primary)] focus:border-[var(--color-brand)] transition-colors placeholder:text-[var(--color-text-muted)]";
