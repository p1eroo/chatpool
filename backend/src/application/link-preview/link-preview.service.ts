import ogs from "open-graph-scraper";
import { AppError } from "../../domain/errors.js";
import type { LinkPreview } from "../../shared/link-preview.js";
import {
  WHATSAPP_LINK_PREVIEW_TIMEOUT_SEC,
  WHATSAPP_LINK_PREVIEW_USER_AGENT,
} from "../../shared/whatsapp-link-preview.constants.js";
import { extractFirstUrl } from "../../shared/url-detection.js";

const CACHE_TTL_MS = 15 * 60 * 1000;

const cache = new Map<string, { expiresAt: number; preview: LinkPreview }>();

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1" || host.startsWith("fe80:")) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function normalizeLinkPreviewUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new AppError("URL inválida", 400, "INVALID_URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError("Solo se permiten URLs http o https", 400, "INVALID_URL");
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new AppError("URL no permitida", 400, "BLOCKED_URL");
  }

  return parsed.toString();
}

function pickOgImage(
  ogImage: { url: string } | { url: string }[] | undefined
): string | undefined {
  if (!ogImage) return undefined;
  if (Array.isArray(ogImage)) return ogImage[0]?.url;
  return ogImage.url;
}

function fallbackPreview(url: string): LinkPreview {
  return {
    url,
    siteName: new URL(url).hostname.replace(/^www\./i, ""),
  };
}

/**
 * Crawl al estilo WhatsApp: mismo User-Agent documentado por Meta + Open Graph.
 * @see https://developers.facebook.com/docs/whatsapp/link-previews/
 */
async function fetchViaWhatsAppCrawler(url: string): Promise<LinkPreview | null> {
  let ogsResult: Awaited<ReturnType<typeof ogs>>;
  try {
    ogsResult = await ogs({
      url,
      timeout: WHATSAPP_LINK_PREVIEW_TIMEOUT_SEC,
      fetchOptions: {
        headers: {
          "User-Agent": WHATSAPP_LINK_PREVIEW_USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      },
    });
  } catch {
    return null;
  }

  const { error, result } = ogsResult;
  if (error || !result) {
    return null;
  }

  const canonicalUrl = result.ogUrl?.trim() || url;
  const title = decodeHtmlEntities(
    (result.ogTitle ?? result.twitterTitle ?? result.dcTitle ?? "").trim()
  );
  const description = decodeHtmlEntities(
    (result.ogDescription ?? result.twitterDescription ?? result.dcDescription ?? "").trim()
  );
  const imageUrl = pickOgImage(result.ogImage as { url: string } | { url: string }[] | undefined);
  const siteName = decodeHtmlEntities(
    (result.ogSiteName ?? new URL(canonicalUrl).hostname.replace(/^www\./i, "")).trim()
  );

  if (!title && !description && !imageUrl) {
    return null;
  }

  return {
    url: canonicalUrl,
    title: title.slice(0, 240) || undefined,
    description: description.slice(0, 320) || undefined,
    imageUrl,
    siteName: siteName.slice(0, 120) || undefined,
  };
}

/** oEmbed de YouTube como refuerzo (Meta solo exige OG; YouTube responde bien vía oEmbed). */
async function fetchYouTubeOEmbed(url: string): Promise<LinkPreview | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }

  if (!["youtube.com", "youtu.be", "m.youtube.com"].includes(hostname)) {
    return null;
  }

  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { "User-Agent": WHATSAPP_LINK_PREVIEW_USER_AGENT },
      signal: AbortSignal.timeout(WHATSAPP_LINK_PREVIEW_TIMEOUT_SEC * 1000),
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let data: {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return null;
  }

  return {
    url,
    title: data.title?.slice(0, 240),
    description: data.author_name ? `Por ${data.author_name}` : undefined,
    imageUrl: data.thumbnail_url,
    siteName: "YouTube",
  };
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  const url = normalizeLinkPreviewUrl(rawUrl);
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.preview;
  }

  let preview: LinkPreview;
  try {
    preview =
      (await fetchYouTubeOEmbed(url)) ??
      (await fetchViaWhatsAppCrawler(url)) ??
      fallbackPreview(url);
  } catch {
    preview = fallbackPreview(url);
  }

  cache.set(url, { preview, expiresAt: Date.now() + CACHE_TTL_MS });
  return preview;
}

export function extractPreviewUrlFromText(text: string): string | null {
  const raw = extractFirstUrl(text);
  if (!raw) return null;
  try {
    return normalizeLinkPreviewUrl(raw);
  } catch {
    return null;
  }
}

/** Meta solo renderiza preview de la primera URL del body. */
export function shouldEnableWhatsAppLinkPreview(body: string): boolean {
  return extractFirstUrl(body) !== null;
}
