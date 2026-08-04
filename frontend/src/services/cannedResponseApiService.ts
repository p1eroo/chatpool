import { apiRequest } from "@/api/client";
import type { CannedResponse } from "@/types";

export type UpsertCannedResponseInput = {
  inboxId: string;
  title: string;
  content: string;
};

export type UpdateCannedResponseInput = {
  title: string;
  content: string;
};

export const cannedResponseApiService = {
  async list(inboxId: string): Promise<CannedResponse[]> {
    const params = new URLSearchParams({ inboxId });
    return apiRequest<CannedResponse[]>(`/canned-responses?${params}`);
  },

  async create(input: UpsertCannedResponseInput): Promise<CannedResponse> {
    return apiRequest<CannedResponse>("/canned-responses", {
      method: "POST",
      body: input,
    });
  },

  async update(id: string, input: UpdateCannedResponseInput): Promise<CannedResponse> {
    return apiRequest<CannedResponse>(`/canned-responses/${id}`, {
      method: "PATCH",
      body: input,
    });
  },

  async remove(id: string): Promise<void> {
    await apiRequest(`/canned-responses/${id}`, { method: "DELETE" });
  },
};
