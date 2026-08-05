import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Message } from "@/types";

/** Indica dirección del último mensaje en la lista (solo vista, sin estado de entrega). */
export function LastMessageDirectionIcon({ message }: { message: Message }) {
  if (message.isPrivate || message.senderType === "system") return null;

  if (message.senderType === "contact") {
    return (
      <ArrowRight
        className="w-3 h-3 shrink-0 text-[var(--color-text-muted)]"
        aria-label="Mensaje recibido"
      />
    );
  }

  if (message.status === "failed") {
    return (
      <span
        className="shrink-0 text-[10px] font-semibold leading-none text-red-400"
        aria-label="Envío fallido"
      >
        !
      </span>
    );
  }

  return (
    <ArrowLeft
      className="w-3 h-3 shrink-0 text-[var(--color-text-muted)]"
      aria-label="Mensaje enviado"
    />
  );
}
