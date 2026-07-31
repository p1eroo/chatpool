import { cn } from "@/lib/utils";

type StatusDotProps = {
  status: "online" | "away" | "busy" | "offline";
  size?: "sm" | "md";
  className?: string;
};

const statusColors = {
  online: "bg-[var(--color-success)]",
  away: "bg-[var(--color-warning)]",
  busy: "bg-[var(--color-danger)]",
  offline: "bg-[var(--color-text-muted)]",
};

const sizeMap = { sm: "w-2 h-2", md: "w-2.5 h-2.5" };

export function StatusDot({ status, size = "sm", className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "rounded-full border-2 border-[var(--color-bg-secondary)]",
        statusColors[status],
        sizeMap[size],
        className
      )}
    />
  );
}
