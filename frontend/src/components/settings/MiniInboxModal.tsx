import { useEffect, useState } from "react";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { DEFAULT_LABEL_COLOR, LabelColorPicker } from "@/components/settings/LabelColorPicker";
import { normalizeHexColor } from "@/lib/labelColorUtils";
import { cn } from "@/lib/utils";
import type { MiniInbox } from "@/types";

export interface MiniInboxInput {
  name: string;
  color: string;
  matchPhrases: string[];
}

interface MiniInboxModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: MiniInboxInput) => Promise<boolean>;
  onUpdate?: (miniInboxId: string, input: MiniInboxInput) => Promise<boolean>;
  /** Si se pasa, el modal edita esa bandejita. */
  initialMiniInbox?: MiniInbox | null;
}

function splitPhrases(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function MiniInboxModal({
  open,
  onClose,
  onCreate,
  onUpdate,
  initialMiniInbox = null,
}: MiniInboxModalProps) {
  const isEditing = Boolean(initialMiniInbox);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_LABEL_COLOR);
  const [phrasesText, setPhrasesText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (initialMiniInbox) {
      setName(initialMiniInbox.name);
      setColor(normalizeHexColor(initialMiniInbox.color));
      setPhrasesText(initialMiniInbox.matchPhrases.join("\n"));
    } else {
      setName("");
      setColor(DEFAULT_LABEL_COLOR);
      setPhrasesText("");
    }
    setError(null);
    setSubmitting(false);
  }, [open, initialMiniInbox]);

  const handleClose = () => {
    setError(null);
    setSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escribe un nombre para la bandejita.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const input: MiniInboxInput = {
      name: trimmed,
      color: normalizeHexColor(color),
      matchPhrases: splitPhrases(phrasesText),
    };

    try {
      let ok: boolean;
      if (isEditing && initialMiniInbox && onUpdate) {
        ok = await onUpdate(initialMiniInbox.id, input);
      } else {
        ok = await onCreate(input);
      }
      if (!ok) {
        setError(
          "No se pudo guardar la bandejita. Puede que el nombre ya exista en esta bandeja."
        );
        return;
      }
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SettingsModal
      open={open}
      onClose={handleClose}
      title={isEditing ? "Editar bandejita" : "Nueva bandejita"}
      description="Sub-colas virtuales solo dentro de esta bandeja."
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
            {submitting
              ? isEditing
                ? "Guardando…"
                : "Creando…"
              : isEditing
                ? "Guardar cambios"
                : "Crear bandejita"}
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
            placeholder="Ej. Leads flota, Postventa"
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

        <label className="block">
          <span className="text-[13px] text-[var(--color-text-secondary)] mb-1.5 block">
            Frases de coincidencia
          </span>
          <textarea
            value={phrasesText}
            onChange={(event) => setPhrasesText(event.target.value)}
            placeholder={"Una frase por línea\nEj. quiero pertenecer a la flota"}
            rows={4}
            className={cn(inputClass, "h-auto py-2 resize-y")}
          />
          <span className="text-[11px] text-[var(--color-text-muted)] mt-1 block">
            Si el mensaje contiene alguna frase, el chat entra solo a esta bandejita. Una por línea.
          </span>
        </label>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      </div>
    </SettingsModal>
  );
}

const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)] transition-colors";
