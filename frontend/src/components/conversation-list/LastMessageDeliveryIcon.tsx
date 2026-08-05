import { Check, CheckCheck, Clock } from "lucide-react";
import type { Message } from "@/types";

/** Palomitas estilo WhatsApp para el preview del último mensaje en la lista. */
export function LastMessageDeliveryIcon({
  message,
}: {
  message: Message;
}) {
  if (message.isPrivate) return null;
  if (message.senderType === "contact") return null;
  if (message.senderType === "system") return null;

  const status = message.status ?? "sent";

  switch (status) {
    case "pending":
      return <Clock className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)] animate-pulse" />;
    case "sent":
      return <Check className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" />;
    case "delivered":
      return <CheckCheck className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" />;
    case "read":
      return <CheckCheck className="w-3.5 h-3.5 shrink-0 text-[var(--color-brand)]" />;
    case "failed":
      return (
        <span className="shrink-0 text-[10px] font-semibold leading-none text-red-400">!</span>
      );
    default:
      return <Check className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" />;
  }
}
