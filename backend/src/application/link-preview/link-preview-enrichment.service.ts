import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import {
  buildLinkPreviewDeliveryPayload,
  buildLinkPreviewSuppressedPayload,
  type LinkPreview,
} from "../../shared/link-preview.js";
import { textContainsUrl } from "../../shared/url-detection.js";
import { mapMessage, messageInclude } from "../mappers.js";
import { emitMessageUpdated } from "../realtime/realtime.service.js";
import {
  extractPreviewUrlFromText,
  fetchLinkPreview,
} from "./link-preview.service.js";

export function scheduleLinkPreviewEnrichment(params: {
  messageId: string;
  conversationId: string;
  content: string;
  contentType: string;
}): void {
  if (params.contentType !== "text" || !textContainsUrl(params.content)) return;

  void enrichMessageLinkPreview(params).catch((error) => {
    console.error(`[link-preview] enrichment failed for ${params.messageId}:`, error);
  });
}

async function enrichMessageLinkPreview(params: {
  messageId: string;
  conversationId: string;
  content: string;
}): Promise<void> {
  const previewUrl = extractPreviewUrlFromText(params.content);
  if (!previewUrl) return;

  const existing = await prisma.message.findUnique({
    where: { id: params.messageId },
    select: { deliveryPayload: true },
  });
  if (!existing) return;
  if (existing.deliveryPayload && typeof existing.deliveryPayload === "object") {
    const kind = (existing.deliveryPayload as Record<string, unknown>).kind;
    if (kind === "link_preview" || kind === "template" || kind === "link_preview_suppressed") return;
  }

  let preview: LinkPreview;
  try {
    preview = await fetchLinkPreview(previewUrl);
  } catch {
    return;
  }

  const updated = await prisma.message.update({
    where: { id: params.messageId },
    data: {
      deliveryPayload: buildLinkPreviewDeliveryPayload(preview) as unknown as Prisma.InputJsonValue,
    },
    include: messageInclude,
  });

  await emitMessageUpdated(params.conversationId, params.messageId, updated);
}

export function buildLinkPreviewPayloadFromBody(
  preview: LinkPreview | undefined,
  content: string,
  suppressLinkPreview?: boolean
): Prisma.InputJsonValue | undefined {
  if (suppressLinkPreview) {
    return buildLinkPreviewSuppressedPayload() as unknown as Prisma.InputJsonValue;
  }

  if (!preview?.url?.trim()) return undefined;
  const normalizedUrl = extractPreviewUrlFromText(content);
  if (!normalizedUrl) return undefined;

  return buildLinkPreviewDeliveryPayload({
    url: normalizedUrl,
    title: preview.title?.trim() || undefined,
    description: preview.description?.trim() || undefined,
    imageUrl: preview.imageUrl?.trim() || undefined,
    siteName: preview.siteName?.trim() || undefined,
  }) as unknown as Prisma.InputJsonValue;
}
