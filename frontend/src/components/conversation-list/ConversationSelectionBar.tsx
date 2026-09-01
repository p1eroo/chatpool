import { Check, CheckSquare, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationSelectionBarProps {
  selectedCount: number;
  allVisibleSelected: boolean;
  canResolve: boolean;
  onClear: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onResolve: () => void;
  className?: string;
}

export function ConversationSelectionBar({
  selectedCount,
  allVisibleSelected,
  canResolve,
  onClear,
  onSelectAll,
  onDeselectAll,
  onResolve,
  className,
}: ConversationSelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Acciones de selección"
      className={cn(
        "inline-flex w-max max-w-none shrink-0 items-center gap-1 rounded-full border border-[var(--color-border-primary)]",
        "bg-[var(--color-bg-secondary)]/95 px-1.5 py-1.5 pr-2 shadow-xl shadow-black/25 backdrop-blur-md",
        "animate-fade-in",
        className
      )}
    >
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
        title="Cerrar selección"
        aria-label="Cerrar selección"
      >
        <X className="h-4 w-4" />
      </button>

      <span className="h-5 w-px shrink-0 bg-[var(--color-border-primary)]" aria-hidden />

      <button
        type="button"
        onClick={allVisibleSelected ? onDeselectAll : onSelectAll}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
        title={allVisibleSelected ? "Deseleccionar todos" : "Seleccionar todos"}
      >
        {allVisibleSelected ? (
          <CheckSquare className="h-4 w-4 text-[var(--color-brand)]" />
        ) : (
          <Square className="h-4 w-4 text-[var(--color-text-secondary)]" />
        )}
        <span>Todos</span>
      </button>

      <span
        className="shrink-0 rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-[11px] font-medium tabular-nums text-[var(--color-text-secondary)]"
        aria-live="polite"
      >
        {selectedCount} seleccionado{selectedCount !== 1 ? "s" : ""}
      </span>

      {canResolve ? (
        <>
          <span className="h-5 w-px shrink-0 bg-[var(--color-border-primary)]" aria-hidden />
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={onResolve}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            Resolver
          </button>
        </>
      ) : null}
    </div>
  );
}
