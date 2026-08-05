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
        const previewUrl = input.imageFile
          ? URL.createObjectURL(input.imageFile)
          : undefined;
        return {
          id: `cr-${Date.now()}`,
          inboxId,
          title: input.title.trim(),
          content: input.content.trim(),
          fileName: input.imageFile?.name,
          mimeType: input.imageFile?.type,
          fileSize: input.imageFile?.size,
          fileUrl: previewUrl,
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
        const list = queryClient.getQueryData<CannedResponse[]>(
          cannedResponseKeys.list(inboxId ?? "")
        );
        const previous = list?.find((item) => item.id === id);
        const previewUrl = input.imageFile
          ? URL.createObjectURL(input.imageFile)
          : input.removeImage
            ? undefined
            : previous?.fileUrl;
        return {
          id,
          inboxId: inboxId ?? "",
          title: input.title.trim(),
          content: input.content.trim(),
          fileName: input.removeImage
            ? undefined
            : input.imageFile?.name ?? previous?.fileName,
          mimeType: input.removeImage
            ? undefined
            : input.imageFile?.type ?? previous?.mimeType,
          fileSize: input.removeImage
            ? undefined
            : input.imageFile?.size ?? previous?.fileSize,
          fileUrl: previewUrl,
          attachmentUrl: previewUrl ? previous?.attachmentUrl : undefined,
        } satisfies CannedResponse;
      }
      return cannedResponseApiService.update(id, input);
    },
    onSuccess: (updated) => {
      const keyInboxId = updated.inboxId || inboxId;
      if (!keyInboxId) return;
      queryClient.setQueryData<CannedResponse[]>(cannedResponseKeys.list(keyInboxId), (prev = []) =>
        prev
          .map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
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
