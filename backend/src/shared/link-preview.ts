import type { Prisma } from "@prisma/client";

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

interface LinkPreviewSuppressedPayload {
  kind: "link_preview_suppressed";
}

export function buildLinkPreviewSuppressedPayload(): LinkPreviewSuppressedPayload {
  return { kind: "link_preview_suppressed" };
}

export function isLinkPreviewSuppressed(value: Prisma.JsonValue | null | undefined): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).kind === "link_preview_suppressed";
}

interface LinkPreviewDeliveryPayload extends LinkPreview {
  kind: "link_preview";
}

export function buildLinkPreviewDeliveryPayload(
  preview: LinkPreview
): LinkPreviewDeliveryPayload {
  return {
    kind: "link_preview",
    url: preview.url,
    title: preview.title,
    description: preview.description,
    imageUrl: preview.imageUrl,
    siteName: preview.siteName,
  };
}

export function parseLinkPreviewDeliveryPayload(
  value: Prisma.JsonValue | null | undefined
): LinkPreview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "link_preview") return null;
  if (typeof record.url !== "string" || !record.url.trim()) return null;

  return {
    url: record.url,
    title: typeof record.title === "string" ? record.title : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : undefined,
    siteName: typeof record.siteName === "string" ? record.siteName : undefined,
  };
}
