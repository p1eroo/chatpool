/**
 * Convierte Markdown típico de Chatwoot al formato de WhatsApp
 * para poder pegar respuestas tal cual y que se vean bien al enviar.
 *
 * - **negrita** → *negrita*
 * - __negrita__ → *negrita*
 * - ~~tachado~~ → ~tachado~
 * - Listas `- item` / `* item` → `• item`
 */
export function normalizeMarkdownToWhatsApp(text: string): string {
  let result = text.replace(/\r\n/g, "\n");

  result = result.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");
  result = result.replace(/__([^_\n]+)__/g, "*$1*");
  result = result.replace(/~~([^~\n]+)~~/g, "~$1~");

  result = result
    .split("\n")
    .map((line) => {
      const listMatch = line.match(/^(\s*)([*-])\s+(.*)$/);
      if (!listMatch) return line;
      return `${listMatch[1]}• ${listMatch[3]}`;
    })
    .join("\n");

  return result;
}
