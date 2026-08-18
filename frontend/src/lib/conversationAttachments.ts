import type { Message } from "@/types";
import { downloadFile } from "@/lib/messageAttachments";

function isVisibleAttachment(message: Message): boolean {
  return !message.isPrivate && Boolean(message.fileUrl || message.attachmentUrl);
}

function sortAttachmentsNewestFirst(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    if (a.sortOrder != null && b.sortOrder != null && a.sortOrder !== b.sortOrder) {
      return b.sortOrder - a.sortOrder;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function getConversationImages(messages: Message[]): Message[] {
  return sortAttachmentsNewestFirst(
    messages.filter(
      (message) => message.contentType === "image" && isVisibleAttachment(message)
    )
  );
}

export function getConversationFiles(messages: Message[]): Message[] {
  return sortAttachmentsNewestFirst(
    messages.filter(
      (message) =>
        (message.contentType === "file" || message.contentType === "audio") &&
        isVisibleAttachment(message)
    )
  );
}

export async function downloadMessageFile(message: Message): Promise<void> {
  await downloadFile({
    fileName: message.fileName || message.content || "archivo",
    attachmentUrl: message.attachmentUrl,
    fileUrl: message.fileUrl,
  });
}
