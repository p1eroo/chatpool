import type { Message } from "@/types";
import { downloadFile } from "@/lib/messageAttachments";

function isVisibleAttachment(message: Message): boolean {
  return !message.isPrivate && Boolean(message.fileUrl || message.attachmentUrl);
}

export function getConversationImages(messages: Message[]): Message[] {
  return messages.filter(
    (message) => message.contentType === "image" && isVisibleAttachment(message)
  );
}

export function getConversationFiles(messages: Message[]): Message[] {
  return messages.filter(
    (message) =>
      (message.contentType === "file" || message.contentType === "audio") &&
      isVisibleAttachment(message)
  );
}

export async function downloadMessageFile(message: Message): Promise<void> {
  await downloadFile({
    fileName: message.fileName || message.content || "archivo",
    attachmentUrl: message.attachmentUrl,
    fileUrl: message.fileUrl,
  });
}
