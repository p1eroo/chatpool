/** Extensiones que no deben tratarse como TLD de un dominio bare. */
const BARE_DOMAIN_BLOCKED_TLD = new Set([
  "txt",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "rar",
  "7z",
  "mp3",
  "mp4",
  "wav",
  "mov",
  "avi",
  "json",
  "xml",
  "csv",
  "md",
  "ts",
  "tsx",
  "js",
  "jsx",
]);

/** http(s)://, www. o dominio tipo whatsapp.com/path (sin protocolo). */
export const URL_IN_TEXT_REGEX =
  /(?:https?:\/\/|www\.)[^\s<>"']+|(?<![@\w./-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63})(?::\d{1,5})?(?:\/[^\s<>"']*)?/gi;

export function isLikelyBareDomainUrl(raw: string): boolean {
  if (/^https?:\/\//i.test(raw) || /^www\./i.test(raw)) return true;

  const host = raw.split("/")[0]?.split(":")[0]?.toLowerCase() ?? "";
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return false;

  const tld = parts[parts.length - 1];
  if (BARE_DOMAIN_BLOCKED_TLD.has(tld)) return false;
  if (!/^[a-z]{2,63}$/i.test(tld)) return false;

  return parts.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

export function textContainsUrl(text: string): boolean {
  return extractFirstUrl(text) !== null;
}

export function splitUrlTrailingPunctuation(raw: string): {
  url: string;
  trailing: string;
} {
  let url = raw;
  let trailing = "";
  while (/[.,!?;:)\]}]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

export function normalizeUrlForHref(raw: string): string {
  const { url } = splitUrlTrailingPunctuation(raw.trim());
  if (!url) return raw;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function normalizeMatch(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || !isLikelyBareDomainUrl(trimmed)) return null;
  return trimmed;
}

export function extractFirstUrl(text: string): string | null {
  URL_IN_TEXT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_IN_TEXT_REGEX.exec(text)) !== null) {
    const normalized = normalizeMatch(match[0]);
    if (normalized) return normalized;
  }
  return null;
}

export function extractAllUrls(text: string): string[] {
  const urls: string[] = [];
  URL_IN_TEXT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_IN_TEXT_REGEX.exec(text)) !== null) {
    const normalized = normalizeMatch(match[0]);
    if (normalized) urls.push(normalized);
  }
  return urls;
}

export function isUrlOnlyMessage(text: string): boolean {
  const url = extractFirstUrl(text);
  if (!url) return false;
  const { url: normalized, trailing } = splitUrlTrailingPunctuation(url);
  const remainder = text.replace(url, "").trim() + trailing;
  return remainder.length === 0 && normalized.length > 0;
}
