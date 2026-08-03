import { formatVoiceTime } from "@/hooks/useVoiceRecorder";
import type { Message } from "@/types";

export function getContactMessagePreview(message: Message): string {
  const text = message.content?.trim();

  switch (message.contentType) {
    case "audio":
      if (text && /^\d+:\d{2}$/.test(text)) return text;
      if (message.audioDuration !== undefined) {
        return formatVoiceTime(message.audioDuration);
      }
      return "Nota de voz";
    case "image":
      return text || "Imagen";
    case "file":
      return message.fileName?.trim() || text || "Archivo";
    default:
      return text || "Mensaje";
  }
}
