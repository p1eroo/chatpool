import type { Message } from "@/types";

function isVisibleAttachment(message: Message): boolean {
  return !message.isPrivate && Boolean(message.fileUrl);
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

export function downloadMessageFile(message: Message): void {
  if (!message.fileUrl) return;

  const link = document.createElement("a");
  link.href = message.fileUrl;
  link.download = message.fileName || message.content || "archivo";
  link.rel = "noopener";
  link.click();
}
