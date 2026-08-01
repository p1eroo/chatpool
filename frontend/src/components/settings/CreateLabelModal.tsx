import { useState } from "react";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { DEFAULT_LABEL_COLOR, LabelColorPicker } from "@/components/settings/LabelColorPicker";
import { normalizeHexColor } from "@/lib/labelColorUtils";
import { cn } from "@/lib/utils";

interface CreateLabelModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => Promise<boolean>;
}

export function CreateLabelModal({ open, onClose, onCreate }: CreateLabelModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_LABEL_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setColor(DEFAULT_LABEL_COLOR);
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escribe un nombre para la etiqueta.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const ok = await onCreate(trimmed, normalizeHexColor(color));
      if (!ok) {
        setError("No se pudo crear la etiqueta. Puede que ya exista en esta bandeja.");
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
      title="Nueva etiqueta"
      description="Las etiquetas solo aplican a conversaciones de esta bandeja."
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-60"
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
            {submitting ? "Creando…" : "Crear etiqueta"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-[13px] text-[var(--color-text-secondary)] mb-1.5 block">
            Nombre
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="Ej. urgente, soporte, ventas"
            className={inputClass}
            autoFocus
          />
        </label>

        <div>
          <span className="text-[13px] text-[var(--color-text-secondary)] mb-2 block">
            Color
          </span>
          <LabelColorPicker value={color} onChange={setColor} />
        </div>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      </div>
    </SettingsModal>
  );
}

const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)] transition-colors";
