import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/env";
import { cannedResponses as seedCannedResponses } from "@/data/mock";
import {
  cannedResponseApiService,
  type UpdateCannedResponseInput,
  type UpsertCannedResponseInput,
} from "@/services/cannedResponseApiService";
import type { CannedResponse } from "@/types";

export const cannedResponseKeys = {
  all: ["canned-responses"] as const,
  list: (inboxId: string) => [...cannedResponseKeys.all, "list", inboxId] as const,
};

export function useCannedResponses(inboxId: string | null | undefined) {
  return useQuery({
    queryKey: cannedResponseKeys.list(inboxId ?? ""),
    enabled: Boolean(inboxId),
    queryFn: async () => {
      if (!inboxId) return [];
      if (env.useMock) {
        return seedCannedResponses
          .filter((item) => !item.inboxId || item.inboxId === inboxId)
          .map((item) => ({ ...item, inboxId: item.inboxId || inboxId }));
      }
      return cannedResponseApiService.list(inboxId);
    },
    staleTime: 30_000,
  });
}

export function useCreateCannedResponse(inboxId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<UpsertCannedResponseInput, "inboxId">) => {
      if (!inboxId) throw new Error("Bandeja no seleccionada");
      if (env.useMock) {
        return {
          id: `cr-${Date.now()}`,
          inboxId,
          title: input.title.trim(),
          content: input.content.trim(),
        } satisfies CannedResponse;
      }
      return cannedResponseApiService.create({ ...input, inboxId });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<CannedResponse[]>(
        cannedResponseKeys.list(created.inboxId),
        (prev = []) =>
          [...prev, created].sort((a, b) => a.title.localeCompare(b.title, "es"))
      );
    },
  });
}

export function useUpdateCannedResponse(inboxId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateCannedResponseInput & { id: string }) => {
      if (env.useMock) {
        return {
          id,
          inboxId: inboxId ?? "",
          title: input.title.trim(),
          content: input.content.trim(),
        } satisfies CannedResponse;
      }
      return cannedResponseApiService.update(id, input);
    },
    onSuccess: (updated) => {
      const keyInboxId = updated.inboxId || inboxId;
      if (!keyInboxId) return;
      queryClient.setQueryData<CannedResponse[]>(cannedResponseKeys.list(keyInboxId), (prev = []) =>
        prev
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.title.localeCompare(b.title, "es"))
      );
    },
  });
}

export function useDeleteCannedResponse(inboxId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!env.useMock) {
        await cannedResponseApiService.remove(id);
      }
      return id;
    },
    onSuccess: (id) => {
      if (!inboxId) return;
      queryClient.setQueryData<CannedResponse[]>(cannedResponseKeys.list(inboxId), (prev = []) =>
        prev.filter((item) => item.id !== id)
      );
    },
  });
}
