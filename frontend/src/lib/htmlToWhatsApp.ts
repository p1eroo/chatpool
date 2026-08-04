import { normalizeMarkdownToWhatsApp } from "@/lib/normalizeMarkdownToWhatsApp";

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "tr",
  "table",
  "blockquote",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/** ¿El HTML trae formato real (negrita, listas, etc.) y no solo wrappers? */
export function hasMeaningfulHtmlFormatting(html: string): boolean {
  if (!html.trim()) return false;
  return (
    /<(strong|b|em|i|s|strike|del|li|ul|ol)\b/i.test(html) ||
    /font-weight\s*:\s*(bold|[6-9]00)/i.test(html) ||
    /font-style\s*:\s*italic/i.test(html) ||
    /text-decoration\s*:[^;]*line-through/i.test(html)
  );
}

function collapseNewlines(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function styleOf(el: Element): string {
  return el.getAttribute("style") ?? "";
}

function isBoldElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "strong" || tag === "b") return true;
  return /font-weight\s*:\s*(bold|[6-9]00)/i.test(styleOf(el));
}

function isItalicElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "em" || tag === "i") return true;
  return /font-style\s*:\s*italic/i.test(styleOf(el));
}

function isStrikeElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "s" || tag === "strike" || tag === "del") return true;
  return /text-decoration\s*:[^;]*line-through/i.test(styleOf(el));
}

/** Envuelve el contenido útil con marcadores WhatsApp, respetando espacios externos. */
function wrapMarker(text: string, marker: "*" | "_" | "~"): string {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return text;
  const [, lead, core, trail] = match;
  const trimmed = core.trim();
  if (!trimmed) return text;

  const already =
    (marker === "*" && /^\*[^*\n]+\*$/.test(trimmed)) ||
    (marker === "_" && /^_[^_\n]+_$/.test(trimmed)) ||
    (marker === "~" && /^~[^~\n]+~$/.test(trimmed));

  if (already) return `${lead}${trimmed}${trail}`;
  return `${lead}${marker}${trimmed}${marker}${trail}`;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "script" || tag === "style" || tag === "meta" || tag === "link") {
    return "";
  }

  if (tag === "br") return "\n";
  if (tag === "hr") return "\n";

  const children = Array.from(el.childNodes).map(serializeNode).join("");

  if (tag === "li") {
    const line = children.replace(/\n+/g, " ").trim();
    return line ? `• ${line}\n` : "";
  }

  if (tag === "ul" || tag === "ol") {
    const body = children.replace(/\n{3,}/g, "\n\n");
    return body.endsWith("\n") ? `${body}\n` : `${body}\n`;
  }

  let result = children;

  if (isBoldElement(el)) result = wrapMarker(result, "*");
  if (isItalicElement(el)) result = wrapMarker(result, "_");
  if (isStrikeElement(el)) result = wrapMarker(result, "~");

  if (tag === "code" || tag === "pre") {
    const core = result.trim();
    if (core && !core.startsWith("```")) {
      result = tag === "pre" ? `\`\`\`${core}\`\`\`` : `\`\`\`${core}\`\`\``;
    }
  }

  if (BLOCK_TAGS.has(tag)) {
    result = `${result}\n`;
  }

  return result;
}

/** Convierte HTML (p. ej. pegado desde Chatwoot) a texto con formato WhatsApp. */
export function htmlToWhatsApp(html: string): string {
  if (typeof DOMParser === "undefined") {
    return normalizeMarkdownToWhatsApp(html);
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const raw = serializeNode(doc.body);
  return normalizeMarkdownToWhatsApp(collapseNewlines(raw));
}

/**
 * Lee el portapapeles: prioriza HTML con formato; si no, texto plano + Markdown.
 */
export function clipboardToWhatsApp(data: DataTransfer | null | undefined): string {
  if (!data) return "";

  const html = data.getData("text/html");
  const plain = data.getData("text/plain");

  if (html && hasMeaningfulHtmlFormatting(html)) {
    const fromHtml = htmlToWhatsApp(html);
    if (fromHtml.trim()) return fromHtml;
  }

  return normalizeMarkdownToWhatsApp(plain || "");
}

/** Inserta texto convertido en un textarea en la posición del cursor. */
export function insertClipboardWhatsAppIntoTextarea(
  el: HTMLTextAreaElement,
  data: DataTransfer,
  currentValue: string
): string {
  const inserted = clipboardToWhatsApp(data);
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? currentValue.length;
  return currentValue.slice(0, start) + inserted + currentValue.slice(end);
}
