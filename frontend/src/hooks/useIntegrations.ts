import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { integrationService } from "@/services/integrationService";
import { refreshConversationsFromApi, refreshInboxDataFromApi } from "@/services/bootstrapService";
import { contactKeys } from "@/hooks/useContacts";
import type { MetaInboxCredentialsDto } from "@/types/api";
import type { IntegrationProvider } from "@/types";

export const integrationKeys = {
  all: ["integrations"] as const,
  accounts: () => [...integrationKeys.all, "accounts"] as const,
  providerInboxes: (provider: IntegrationProvider) =>
    [...integrationKeys.all, "inboxes", provider] as const,
};

export function useIntegrationAccounts() {
  return useQuery({
    queryKey: integrationKeys.accounts(),
    queryFn: () => integrationService.getAccounts(),
    staleTime: 30_000,
  });
}

export function useProviderInboxes(provider: IntegrationProvider) {
  return useQuery({
    queryKey: integrationKeys.providerInboxes(provider),
    queryFn: () => integrationService.getInboxesForProvider(provider),
    staleTime: 10_000,
  });
}

export function useVerifyMetaConnection(inboxId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: MetaInboxCredentialsDto) =>
      integrationService.verifyMetaConnection(inboxId, credentials),
    onSuccess: async (result) => {
      if (result.ok) {
        await refreshInboxDataFromApi();
        await refreshConversationsFromApi();
        void queryClient.invalidateQueries({ queryKey: contactKeys.all });
      }
      void queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
}

export function useRegisterInboxWebhook(inboxId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      integrationService.registerInboxWebhook(inboxId, provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
}
