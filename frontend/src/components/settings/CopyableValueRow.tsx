import { Copy } from "lucide-react";

interface CopyableValueRowProps {
  label: string;
  value: string;
  onCopy: () => void;
  hint?: string;
}

/** Fila compacta para copiar URL/token de webhook en settings. */
export function CopyableValueRow({ label, value, onCopy, hint }: CopyableValueRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-[13px] text-[var(--color-text-muted)] shrink-0 pt-0.5">{label}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 justify-end">
          <code className="text-[11px] text-[var(--color-text-secondary)] break-all text-right">
            {value}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
            title={`Copiar ${label.toLowerCase()}`}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        {hint ? (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 text-right">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
