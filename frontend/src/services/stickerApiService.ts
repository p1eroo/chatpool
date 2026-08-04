import { apiRequest } from "@/api/client";
import { parseMessage } from "@/lib/parseApiDates";
import type { Message, SavedSticker } from "@/types";

export const stickerApiService = {
  async list(): Promise<SavedSticker[]> {
    return apiRequest<SavedSticker[]>("/stickers");
  },

  async saveFromMessage(conversationId: string, messageId: string): Promise<SavedSticker> {
    return apiRequest<SavedSticker>(
      `/conversations/${conversationId}/messages/${messageId}/save-sticker`,
      { method: "POST" }
    );
  },

  async send(
    conversationId: string,
    stickerId: string,
    replyToMessageId?: string
  ): Promise<Message> {
    const row = await apiRequest<Message>(
      `/conversations/${conversationId}/stickers/${stickerId}/send`,
      {
        method: "POST",
        body: replyToMessageId ? { replyToMessageId } : {},
      }
    );
    return parseMessage(row as never);
  },

  async remove(stickerId: string): Promise<void> {
    await apiRequest(`/stickers/${stickerId}`, { method: "DELETE" });
  },
};
