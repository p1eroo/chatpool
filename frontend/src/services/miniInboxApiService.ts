import { apiRequest } from "@/api/client";
import { normalizeHexColor } from "@/lib/labelColorUtils";
import type { MiniInbox } from "@/types";

export interface MiniInboxInput {
  name: string;
  color: string;
  matchPhrases: string[];
}

export const miniInboxApiService = {
  async listForInbox(inboxId: string): Promise<MiniInbox[]> {
    return apiRequest<MiniInbox[]>(`/inboxes/${inboxId}/mini-inboxes`);
  },

  async listAll(): Promise<MiniInbox[]> {
    return apiRequest<MiniInbox[]>("/mini-inboxes");
  },

  async create(inboxId: string, input: MiniInboxInput): Promise<MiniInbox> {
    return apiRequest<MiniInbox>(`/inboxes/${inboxId}/mini-inboxes`, {
      method: "POST",
      body: {
        name: input.name.trim(),
        color: normalizeHexColor(input.color),
        matchPhrases: input.matchPhrases,
      },
    });
  },

  async update(
    inboxId: string,
    miniInboxId: string,
    input: MiniInboxInput
  ): Promise<MiniInbox> {
    return apiRequest<MiniInbox>(`/inboxes/${inboxId}/mini-inboxes/${miniInboxId}`, {
      method: "PATCH",
      body: {
        name: input.name.trim(),
        color: normalizeHexColor(input.color),
        matchPhrases: input.matchPhrases,
      },
    });
  },

  async delete(inboxId: string, miniInboxId: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>(`/inboxes/${inboxId}/mini-inboxes/${miniInboxId}`, {
      method: "DELETE",
    });
  },
};
