import { RefreshCw, Sparkles } from "lucide-react";
import {
  APP_UPDATE_AUTO_RELOAD_SECONDS,
  useAppUpdateCheck,
} from "@/hooks/useAppUpdateCheck";
import { cn } from "@/lib/utils";

export function AppUpdateModal() {
  const { updateAvailable, reload, secondsRemaining, isMockPreview } = useAppUpdateCheck();

  if (!updateAvailable) return null;

  const seconds = secondsRemaining ?? APP_UPDATE_AUTO_RELOAD_SECONDS;
  const progress =
    ((APP_UPDATE_AUTO_RELOAD_SECONDS - seconds) / APP_UPDATE_AUTO_RELOAD_SECONDS) * 100;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
      aria-describedby="app-update-description"
      data-modal-overlay
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
    >
      <div className="absolute inset-0 bg-[var(--color-bg-primary)]/80 backdrop-blur-md" />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] shadow-2xl shadow-black/30">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-[var(--color-brand)]/20"
          aria-hidden
        >
          <div
            className="h-full bg-[var(--color-brand)] transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-8 pt-10 pb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
            <Sparkles className="h-8 w-8" />
          </div>

          <h2
            id="app-update-title"
            className="text-xl font-semibold text-[var(--color-text-primary)]"
          >
            Nueva versión disponible
          </h2>

          <p
            id="app-update-description"
            className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]"
          >
            Chatpool se actualizará automáticamente para que uses la última versión y evites
            errores.
          </p>

          <div className="mt-8 flex flex-col items-center gap-2">
            <span
              className={cn(
                "inline-flex h-14 w-14 items-center justify-center rounded-full",
                "bg-[var(--color-bg-tertiary)] text-2xl font-semibold tabular-nums",
                "text-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/25"
              )}
              aria-live="polite"
              aria-label={
                seconds === 1
                  ? "Actualizando en 1 segundo"
                  : `Actualizando en ${seconds} segundos`
              }
            >
              {seconds}
            </span>
          </div>

          <button
            type="button"
            onClick={reload}
            className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-light)] active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar ahora
          </button>

          {isMockPreview && (
            <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">
              Vista previa (mock). Quita{" "}
              <code className="rounded bg-[var(--color-bg-tertiary)] px-1 py-0.5">?mockUpdate=1</code>{" "}
              de la URL para ocultar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
