import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { stickerApiService } from "@/services/stickerApiService";
import type { SavedSticker } from "@/types";

export const savedStickerKeys = {
  all: ["saved-stickers"] as const,
  list: () => [...savedStickerKeys.all, "list"] as const,
};

export function useSavedStickers() {
  return useQuery({
    queryKey: savedStickerKeys.list(),
    queryFn: () => stickerApiService.list(),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

export function useSaveStickerFromMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      messageId,
    }: {
      conversationId: string;
      messageId: string;
    }) => stickerApiService.saveFromMessage(conversationId, messageId),
    onSuccess: (created) => {
      queryClient.setQueryData<SavedSticker[]>(savedStickerKeys.list(), (prev = []) => {
        if (prev.some((item) => item.id === created.id)) return prev;
        return [created, ...prev];
      });
    },
  });
}

export function useDeleteSavedSticker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stickerId: string) => stickerApiService.remove(stickerId),
    onSuccess: (_void, stickerId) => {
      queryClient.setQueryData<SavedSticker[]>(savedStickerKeys.list(), (prev = []) =>
        prev.filter((item) => item.id !== stickerId)
      );
    },
  });
}
