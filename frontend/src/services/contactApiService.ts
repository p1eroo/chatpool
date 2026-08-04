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

export type UpdateContactInput = {
  name?: string;
  phone?: string | null;
  email?: string;
  city?: string | null;
  company?: string | null;
  isBlocked?: boolean;
};

export const contactApiService = {
  async list(filters?: { inboxId?: string | null }): Promise<Contact[]> {
    const params = new URLSearchParams();
    if (filters?.inboxId) params.set("inboxId", filters.inboxId);

    const query = params.toString();
    const rows = await apiRequest<Contact[]>(`/contacts${query ? `?${query}` : ""}`);
    return rows.map((row) => parseContact(row as never));
  },

  async update(contactId: string, patch: UpdateContactInput): Promise<Contact> {
    const row = await apiRequest<Contact>(`/contacts/${contactId}`, {
      method: "PATCH",
      body: patch,
    });
    return parseContact(row as never);
  },

  async remove(contactId: string): Promise<void> {
    await apiRequest(`/contacts/${contactId}`, { method: "DELETE" });
  },
};
