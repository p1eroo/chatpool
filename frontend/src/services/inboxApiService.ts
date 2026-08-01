import { apiRequest } from "@/api/client";
import type { Inbox, InboxSettings } from "@/types";
import type { CreateInboxInput } from "@/store/inboxStore";
import { getProviderForChannel } from "@/lib/inboxUtils";

export const inboxApiService = {
  async listInboxes(): Promise<Inbox[]> {
    return apiRequest<Inbox[]>("/inboxes");
  },

  async listSettings(): Promise<InboxSettings[]> {
    return apiRequest<InboxSettings[]>("/inboxes/settings");
  },

  async create(input: CreateInboxInput & {
    detail: string;
    providerResource: string;
    description?: string;
    assignedAgentIds?: string[];
    phoneNumberId?: string;
    businessAccountId?: string;
    accessToken?: string;
  }): Promise<{ inbox: Inbox; settings: InboxSettings }> {
    return apiRequest("/inboxes", {
      method: "POST",
      body: {
        name: input.name,
        channelType: input.channelType,
        detail: input.detail,
        providerResource: input.providerResource,
        description: input.description,
        assignedAgentIds: input.assignedAgentIds,
        phoneNumberId: input.phoneNumberId,
        businessAccountId: input.businessAccountId,
        accessToken: input.accessToken,
      },
    });
  },
};

export { getProviderForChannel };
