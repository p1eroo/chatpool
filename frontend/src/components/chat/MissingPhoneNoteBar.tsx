import { Phone } from "lucide-react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { contactHasPhone, MISSING_WHATSAPP_PHONE_NOTE } from "@/lib/whatsappContactInfo";
import { isWhatsAppReplyWindowClosed } from "@/lib/whatsappReplyWindow";

export function MissingPhoneNoteBar({ conversationId }: { conversationId: string }) {
  const requestContactInfo = useConversationStore((s) => s.requestContactInfo);
  const messages = useConversationStore((s) => s.messages[conversationId] ?? []);
  const conversation = useConversationStore((s) =>
    s.conversations.find((item) => item.id === conversationId)
  );
  const showToast = useUIStore((s) => s.showToast);
  const windowClosed = isWhatsAppReplyWindowClosed(conversation?.channelType, messages);

  if (contactHasPhone(conversation?.contact.phone)) return null;

  return (
    <div className="shrink-0 border-t border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 py-2.5">
      <div className="bg-[var(--color-note-bg)] border-l-[3px] border-amber-500/60 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <svg
            className="w-3 h-3 text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
            Nota privada
          </span>
        </div>
        <p className="text-[13px] text-[var(--color-text-primary)] leading-relaxed">
          {MISSING_WHATSAPP_PHONE_NOTE}
        </p>
        <button
          type="button"
          onClick={() => {
            if (windowClosed) {
              showToast(
                "La ventana de 24 horas está cerrada. Pídelo cuando el cliente vuelva a escribir."
              );
              return;
            }
            void requestContactInfo(conversationId).then((ok) => {
              if (ok) {
                showToast("Se pidió el número. El cliente verá el botón en WhatsApp.");
              }
            });
          }}
          className="mt-2 h-8 px-2.5 text-xs font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors inline-flex items-center gap-1.5 border border-[var(--color-border-primary)]"
        >
          <Phone className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          Pedir número
        </button>
      </div>
    </div>
  );
}
