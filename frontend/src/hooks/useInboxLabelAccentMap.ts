import { useMemo } from "react";
import { assignUniqueLabelAccentColors } from "@/lib/labelColorUtils";
import { useLabelStore } from "@/store/labelStore";

/** Colores únicos y estables de etiquetas para una bandeja (mismo mapa en todo el proyecto). */
export function useInboxLabelAccentMap(
  inboxId: string | null | undefined
): Record<string, string> {
  const labels = useLabelStore((s) => s.labels);

  return useMemo(() => {
    if (!inboxId) return {};
    return assignUniqueLabelAccentColors(
      labels.filter((label) => label.inboxId === inboxId)
    );
  }, [inboxId, labels]);
}
