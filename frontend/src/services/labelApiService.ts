import { apiRequest } from "@/api/client";
import { normalizeHexColor } from "@/lib/labelColorUtils";
import type { Label } from "@/types";

export const labelApiService = {
  async listForInbox(inboxId: string): Promise<Label[]> {
    return apiRequest<Label[]>(`/inboxes/${inboxId}/labels`);
  },

  async create(
    inboxId: string,
    input: { name: string; color: string }
  ): Promise<Label> {
    return apiRequest<Label>(`/inboxes/${inboxId}/labels`, {
      method: "POST",
      body: {
        name: input.name.trim().toLowerCase(),
        color: normalizeHexColor(input.color),
      },
    });
  },

  async listAll(): Promise<Label[]> {
    return apiRequest<Label[]>("/labels");
  },

  async delete(inboxId: string, labelId: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>(`/inboxes/${inboxId}/labels/${labelId}`, {
      method: "DELETE",
    });
  },
};
