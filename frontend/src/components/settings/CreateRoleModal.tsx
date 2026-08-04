import { useState } from "react";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { cn } from "@/lib/utils";

interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => boolean | Promise<boolean>;
}

export function CreateRoleModal({ open, onClose, onCreate }: CreateRoleModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    try {
      const ok = await onCreate(name.trim());
      if (!ok) {
        setError("Revisa el nombre o si el rol ya existe.");
        return;
      }
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
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
            onClick={() => void handleSubmit()}
            disabled={!name.trim() || submitting}
            className={cn(
              "h-9 px-4 text-sm font-medium rounded-lg transition-colors",
              name.trim() && !submitting
                ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)]"
                : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed"
            )}
          >
            {submitting ? "Creando…" : "Crear rol"}
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
