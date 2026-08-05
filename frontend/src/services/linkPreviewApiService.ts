import { apiRequest } from "@/api/client";
import type { LinkPreview } from "@/types";

export const linkPreviewApi = {
  async fetch(url: string): Promise<LinkPreview> {
    const params = new URLSearchParams({ url });
    return apiRequest<LinkPreview>(`/link-preview?${params.toString()}`);
  },
};
