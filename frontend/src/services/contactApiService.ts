import { apiRequest } from "@/api/client";
import type { Contact } from "@/types";

function parseContact(raw: Contact & { lastSeen?: string | Date | null }): Contact {
  return {
    ...raw,
    lastSeen: raw.lastSeen
      ? raw.lastSeen instanceof Date
        ? raw.lastSeen
        : new Date(raw.lastSeen)
      : undefined,
  };
}

export const contactApiService = {
  async list(filters?: { inboxId?: string | null }): Promise<Contact[]> {
    const params = new URLSearchParams();
    if (filters?.inboxId) params.set("inboxId", filters.inboxId);

    const query = params.toString();
    const rows = await apiRequest<Contact[]>(`/contacts${query ? `?${query}` : ""}`);
    return rows.map((row) => parseContact(row as never));
  },
};
