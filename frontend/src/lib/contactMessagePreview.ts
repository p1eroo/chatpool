import { formatVoiceTime } from "@/hooks/useVoiceRecorder";
import { stripWhatsAppFormatting } from "@/lib/whatsappFormatting";
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
      return text ? stripWhatsAppFormatting(text) : "Imagen";
    case "sticker":
      return "Sticker";
    case "file":
      return message.fileName?.trim() || (text ? stripWhatsAppFormatting(text) : "Archivo");
    default:
      return text ? stripWhatsAppFormatting(text) : "Mensaje";
  }
}
