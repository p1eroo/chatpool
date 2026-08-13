import { formatVoiceTime } from "@/hooks/useVoiceRecorder";
import { stripWhatsAppFormatting } from "@/lib/whatsappFormatting";
import {
  displayInboundMessageContent,
  isSharedContactMessageContent,
  parseSharedContactDisplay,
} from "@/lib/whatsappContactInfo";
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
    case "location":
      return (
        message.location?.name?.trim() ||
        message.location?.address?.trim() ||
        (text && text !== "[location]" ? stripWhatsAppFormatting(text) : "Ubicación")
      );
    case "file":
      return message.fileName?.trim() || (text ? stripWhatsAppFormatting(text) : "Archivo");
    default:
      if (text === "[location]") return "Ubicación";
      if (isSharedContactMessageContent(text)) {
        const { title, subtitle } = parseSharedContactDisplay(text ?? "");
        return subtitle ? `${title}: ${subtitle}` : title;
      }
      return text ? stripWhatsAppFormatting(displayInboundMessageContent(text)) : "Mensaje";
  }
}
