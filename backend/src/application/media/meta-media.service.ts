import { metaApiClient } from "../../infrastructure/meta/meta-api.client.js";
import { uploadConversationMedia } from "./media-storage.service.js";
import type { MessageContentType } from "@prisma/client";
import {
  formatLocationContent,
  parseMessageLocation,
  type MessageLocationPayload,
} from "../../shared/message-location.js";

interface MetaMediaPayload {
  id?: string;
  mime_type?: string;
  filename?: string;
  caption?: string;
  sha256?: string;
}

interface ParsedIncomingMedia {
  contentType: MessageContentType;
  content: string;
  fileName: string;
  mimeType: string;
  mediaId: string;
  location?: MessageLocationPayload;
}

function extensionFromMime(mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "xlsx";
  if (mime.includes("word")) return "docx";
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/jpeg")) return "jpg";
  if (mime.startsWith("image/png")) return "png";
  if (mime.startsWith("image/webp")) return "webp";
  if (mime.startsWith("image/gif")) return "gif";
  if (mime.startsWith("audio/ogg")) return "ogg";
  if (mime.startsWith("audio/mpeg")) return "mp3";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "mp4";
  return "bin";
}

function defaultFileName(type: string, mimeType: string, messageId: string): string {
  const ext = extensionFromMime(mimeType);
  return `${type}-${messageId.slice(0, 8)}.${ext}`;
}

function textContent(content: string): ParsedIncomingMedia {
  return {
    contentType: "text",
    content,
    fileName: "",
    mimeType: "text/plain",
    mediaId: "",
  };
}

/** Texto visible de un quick-reply de plantilla (`type: button`) o reply interactivo. */
export function parseInboundButtonOrInteractiveContent(payload: {
  type?: string;
  button?: { payload?: string; text?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
}): string | null {
  const type = (payload.type ?? "").trim().toLowerCase();

  if (type === "button") {
    const text = payload.button?.text?.trim() || payload.button?.payload?.trim();
    return text || null;
  }

  if (type === "interactive") {
    const reply =
      payload.interactive?.button_reply ?? payload.interactive?.list_reply;
    const text = reply?.title?.trim() || reply?.id?.trim();
    return text || null;
  }

  return null;
}

export function parseIncomingMetaMedia(
  type: string | undefined,
  messageId: string,
  payload: {
    text?: { body?: string };
    button?: { payload?: string; text?: string };
    interactive?: {
      type?: string;
      button_reply?: { id?: string; title?: string };
      list_reply?: { id?: string; title?: string; description?: string };
    };
    document?: MetaMediaPayload;
    image?: MetaMediaPayload;
    audio?: MetaMediaPayload;
    voice?: MetaMediaPayload;
    video?: MetaMediaPayload;
    sticker?: MetaMediaPayload;
    location?: {
      latitude?: number | string;
      longitude?: number | string;
      name?: string;
      address?: string;
    };
  }
): ParsedIncomingMedia | null {
  switch (type) {
    case "text":
      if (payload.text?.body) {
        return textContent(payload.text.body);
      }
      return null;
    case "button":
    case "interactive": {
      const content = parseInboundButtonOrInteractiveContent({ type, ...payload });
      return content ? textContent(content) : null;
    }
    case "location": {
      const location = parseMessageLocation(payload.location);
      if (!location) return null;
      return {
        contentType: "location",
        content: formatLocationContent(location),
        fileName: "",
        mimeType: "application/geo+json",
        mediaId: "",
        location,
      };
    }
    case "document": {
      const media = payload.document;
      if (!media?.id) return null;
      const fileName =
        media.filename?.trim() ||
        defaultFileName("document", media.mime_type ?? "application/octet-stream", messageId);
      return {
        contentType: "file",
        content: media.caption?.trim() || fileName,
        fileName,
        mimeType: media.mime_type ?? "application/octet-stream",
        mediaId: media.id,
      };
    }
    case "image": {
      const media = payload.image;
      if (!media?.id) return null;
      const fileName = defaultFileName("image", media.mime_type ?? "image/jpeg", messageId);
      return {
        contentType: "image",
        content: media.caption?.trim() || fileName,
        fileName,
        mimeType: media.mime_type ?? "image/jpeg",
        mediaId: media.id,
      };
    }
    case "sticker": {
      const media = payload.sticker;
      if (!media?.id) return null;
      const mimeType = media.mime_type ?? "image/webp";
      const fileName = defaultFileName("sticker", mimeType, messageId);
      return {
        contentType: "sticker",
        content: "Sticker",
        fileName,
        mimeType,
        mediaId: media.id,
      };
    }
    case "audio":
    case "voice": {
      const media = payload.audio ?? payload.voice;
      if (!media?.id) return null;
      const fileName = defaultFileName("audio", media.mime_type ?? "audio/ogg", messageId);
      return {
        contentType: "audio",
        content: media.caption?.trim() || fileName,
        fileName,
        mimeType: media.mime_type ?? "audio/ogg",
        mediaId: media.id,
      };
    }
    case "video": {
      const media = payload.video;
      if (!media?.id) return null;
      const fileName = defaultFileName("video", media.mime_type ?? "video/mp4", messageId);
      return {
        contentType: "file",
        content: media.caption?.trim() || fileName,
        fileName,
        mimeType: media.mime_type ?? "video/mp4",
        mediaId: media.id,
      };
    }
    default:
      return null;
  }
}

export async function downloadAndStoreMetaMedia(params: {
  conversationId: string;
  accessToken: string;
  mediaId: string;
  fileName: string;
  mimeType: string;
}): Promise<{ fileKey: string; fileUrl: string; fileName: string; fileSize: number; mimeType: string }> {
  const metadata = await metaApiClient.getMediaMetadata(params.mediaId, params.accessToken);
  const buffer = await metaApiClient.downloadMedia(metadata.url, params.accessToken);

  return uploadConversationMedia({
    conversationId: params.conversationId,
    buffer,
    originalName: params.fileName,
    mimeType: metadata.mimeType || params.mimeType,
  });
}
