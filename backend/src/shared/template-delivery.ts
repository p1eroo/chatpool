import type { Prisma } from "@prisma/client";

export interface TemplateButtonPreview {
  type: string;
  text: string;
}

export function parseTemplateButtonsFromDeliveryPayload(
  value: Prisma.JsonValue | null | undefined
): TemplateButtonPreview[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  if (record.kind !== "template") return undefined;

  const buttons = record.buttons;
  if (!Array.isArray(buttons)) return undefined;

  const parsed = buttons
    .map((item): TemplateButtonPreview | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const text = typeof row.text === "string" ? row.text.trim() : "";
      const type = typeof row.type === "string" ? row.type : "UNKNOWN";
      if (!text) return null;
      return { type, text };
    })
    .filter((item): item is TemplateButtonPreview => item !== null);

  return parsed.length ? parsed : undefined;
}
