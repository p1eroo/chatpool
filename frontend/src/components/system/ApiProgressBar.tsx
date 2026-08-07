import { useEffect, useState } from "react";
import { useApiLoadingStore } from "@/store/apiLoadingStore";
import { cn } from "@/lib/utils";

/** Barra superior global mientras hay requests API en pending. */
export function ApiProgressBar() {
  const pendingCount = useApiLoadingStore((s) => s.pendingCount);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pendingCount > 0) {
      const showTimer = window.setTimeout(() => setVisible(true), 80);
      return () => window.clearTimeout(showTimer);
    }

    const hideTimer = window.setTimeout(() => setVisible(false), 180);
    return () => window.clearTimeout(hideTimer);
  }, [pendingCount]);

  if (!visible && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden transition-opacity duration-150",
        pendingCount > 0 ? "opacity-100" : "opacity-0"
      )}
      role="progressbar"
      aria-busy={pendingCount > 0}
      aria-label="Cargando"
    >
      <div className="h-full w-full bg-[var(--color-brand)]/20" />
      <div className="absolute inset-y-0 w-1/3 bg-[var(--color-brand)] animate-api-progress shadow-[0_0_8px_var(--color-brand)]" />
    </div>
  );
}
