import { RefreshCw, Sparkles, X } from "lucide-react";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";

export function AppUpdateBanner() {
  const { updateAvailable, dismiss, reload } = useAppUpdateCheck();

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[9999] px-4 pt-3 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-2xl items-start gap-3 rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-bg-secondary)]/95 backdrop-blur-md p-4 shadow-2xl shadow-black/20 animate-fade-in">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
          <Sparkles className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Nueva versión disponible
          </p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--color-text-secondary)]">
            Chatpool se actualizó. Recarga para usar la última versión y evitar errores.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={reload}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-3 text-xs font-medium text-white transition-colors hover:bg-[var(--color-brand-light)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualizar ahora
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              Más tarde
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          aria-label="Cerrar aviso de actualización"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
