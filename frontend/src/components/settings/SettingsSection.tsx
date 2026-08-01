import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-lg overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-primary)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
          {description && (
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SettingsField({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-[var(--color-border-primary)] last:border-b-0">
      <span className="text-[13px] text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span
        className={cn(
          "text-[13px] text-[var(--color-text-primary)] text-right",
          mono && "font-mono text-[12px] break-all"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function InboxStatusBadge({ status }: { status: "active" | "pending" | "disabled" }) {
  return (
    <span
      className={cn(
        "text-[11px] px-2 py-0.5 rounded-full font-medium",
        status === "active" && "bg-[var(--color-success)]/10 text-[var(--color-success)]",
        status === "pending" && "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
        status === "disabled" && "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]"
      )}
    >
      {status === "active" ? "Activo" : status === "pending" ? "Pendiente" : "Desactivado"}
    </span>
  );
}
