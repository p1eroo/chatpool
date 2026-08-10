import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { outgoingWebhookService } from "@/services/outgoingWebhookService";
import type {
  CreateOutgoingWebhookRequest,
  UpdateOutgoingWebhookRequest,
} from "@/types/api";

export const outgoingWebhookKeys = {
  all: ["outgoing-webhooks"] as const,
  list: (inboxId?: string) =>
    [...outgoingWebhookKeys.all, "list", inboxId ?? "all"] as const,
};

export function useOutgoingWebhooks(inboxId?: string) {
  return useQuery({
    queryKey: outgoingWebhookKeys.list(inboxId),
    queryFn: () => outgoingWebhookService.list(inboxId),
    staleTime: 15_000,
  });
}

export function useCreateOutgoingWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOutgoingWebhookRequest) => outgoingWebhookService.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: outgoingWebhookKeys.all });
    },
  });
}

export function useUpdateOutgoingWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOutgoingWebhookRequest }) =>
      outgoingWebhookService.update(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: outgoingWebhookKeys.all });
    },
  });
}

export function useDeleteOutgoingWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => outgoingWebhookService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: outgoingWebhookKeys.all });
    },
  });
}
