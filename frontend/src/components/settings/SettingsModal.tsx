import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

export function SettingsModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: SettingsModalProps) {
  if (!open) return null;

  return (
    <div data-modal-overlay className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-2xl animate-fade-in max-h-[90vh] flex flex-col",
          wide ? "max-w-2xl" : "max-w-lg"
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border-primary)] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
            {description && (
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>

        {footer && (
          <div className="px-5 py-4 border-t border-[var(--color-border-primary)] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--color-text-primary)]">{label}</p>
        {description && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={label}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out mt-0.5",
          checked
            ? "bg-[var(--color-brand)]"
            : "bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)]",
          disabled ? "pointer-events-none opacity-70" : "cursor-pointer"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out",
            checked ? "left-[calc(100%-1rem-2px)]" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}

export { Toggle as SettingsToggle };
