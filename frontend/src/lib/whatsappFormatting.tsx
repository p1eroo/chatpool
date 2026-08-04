import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Formato WhatsApp (+ **negrita** Markdown por compatibilidad al pegar). */
function renderWhatsAppInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex =
    /(```[^`\n]+```|\*\*[^*\n]+\*\*|\*[^*\n]+\*|__[^_\n]+__|_[^_\n]+_|~~[^~\n]+~~|~[^~\n]+~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("```") && token.endsWith("```")) {
      parts.push(
        <code
          key={key++}
          className="font-mono text-[0.92em] bg-black/15 px-1 py-0.5 rounded"
        >
          {token.slice(3, -3)}
        </code>
      );
    } else if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      parts.push(
        <span key={key++} className="line-through">
          {token.slice(2, -2)}
        </span>
      );
    } else {
      const inner = token.slice(1, -1);
      if (token.startsWith("*")) {
        parts.push(
          <strong key={key++} className="font-semibold">
            {inner}
          </strong>
        );
      } else if (token.startsWith("_")) {
        parts.push(
          <em key={key++} className="italic">
            {inner}
          </em>
        );
      } else {
        parts.push(
          <span key={key++} className="line-through">
            {inner}
          </span>
        );
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : [text];
}

/** Texto con saltos de línea y formato WhatsApp (*negrita*, _cursiva_, etc.). */
export function WhatsAppFormattedText({
  text,
  className,
  as: Tag = "p",
}: {
  text: string;
  className?: string;
  as?: "p" | "div" | "span";
}) {
  const lines = text.split("\n");

  return (
    <Tag className={cn("whitespace-pre-wrap break-words", className)}>
      {lines.map((line, index) => (
        <span key={index}>
          {renderWhatsAppInline(line)}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </Tag>
  );
}

/** Quita marcadores de formato para previews en una sola línea. */
export function stripWhatsAppFormatting(text: string): string {
  return text
    .replace(/```([^`\n]+)```/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/~([^~\n]+)~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
