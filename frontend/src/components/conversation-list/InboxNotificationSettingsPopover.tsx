import { Volume2 } from "lucide-react";
import { previewNotificationSound } from "@/lib/notificationSound";
import { useNotificationSettingsStore } from "@/store/notificationSettingsStore";
import { cn } from "@/lib/utils";

interface InboxNotificationSettingsPopoverProps {
  open: boolean;
}

export function InboxNotificationSettingsPopover({
  open,
}: InboxNotificationSettingsPopoverProps) {
  const volume = useNotificationSettingsStore((s) => s.volume);
  const setVolume = useNotificationSettingsStore((s) => s.setVolume);

  if (!open) return null;

  const volumePercent = Math.round(volume * 100);
  const isSilent = volumePercent === 0;

  return (
    <div className="absolute top-full right-0 mt-1 w-[272px] bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-xl shadow-xl z-50 p-3 animate-fade-in">
      <div className="mb-3">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          Notificaciones
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          Sonido al recibir mensajes nuevos
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-primary)]">Volumen</span>
            </div>
            <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
              {volumePercent}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volumePercent}
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
            className={cn(
              "h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-bg-tertiary)]",
              "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-brand)] [&::-webkit-slider-thumb]:shadow",
              "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--color-brand)]"
            )}
          />
        </div>

        <button
          type="button"
          disabled={isSilent}
          onClick={() => previewNotificationSound()}
          className={cn(
            "w-full rounded-lg border border-[var(--color-border-primary)] px-3 py-2 text-sm transition-colors",
            isSilent
              ? "text-[var(--color-text-muted)] cursor-not-allowed opacity-50"
              : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          )}
        >
          Probar sonido
        </button>
      </div>
    </div>
  );
}
