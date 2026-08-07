import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Forward, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalWhatsAppPhoneDisplay } from "@/lib/whatsappPhone";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import type { Conversation } from "@/types";

interface ForwardMessagesModalProps {
  open: boolean;
  sourceConversationId: string | null;
  messageIds: string[];
  onClose: () => void;
}

function conversationSearchText(conversation: Conversation): string {
  const phone = conversation.contact.phone ?? "";
  return `${conversation.contact.name} ${phone} ${formatLocalWhatsAppPhoneDisplay(phone)}`.toLowerCase();
}

export function ForwardMessagesModal({
  open,
  sourceConversationId,
  messageIds,
  onClose,
}: ForwardMessagesModalProps) {
  const conversations = useConversationStore((s) => s.conversations);
  const forwardMessages = useConversationStore((s) => s.forwardMessages);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sourceConversation = useMemo(
    () => conversations.find((item) => item.id === sourceConversationId) ?? null,
    [conversations, sourceConversationId]
  );

  const eligibleConversations = useMemo(() => {
    if (!sourceConversation) return [];

    const query = search.trim().toLowerCase();

    return conversations
      .filter(
        (conversation) =>
          conversation.inboxId === sourceConversation.inboxId &&
          conversation.channelType === "whatsapp" &&
          conversation.id !== sourceConversationId
      )
      .filter((conversation) =>
        query ? conversationSearchText(conversation).includes(query) : true
      )
      .sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [conversations, search, sourceConversation, sourceConversationId]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedIds([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !sourceConversationId || messageIds.length === 0) return null;

  const toggleTarget = (conversationId: string) => {
    setSelectedIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId]
    );
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) return;
    forwardMessages(sourceConversationId, messageIds, selectedIds);
    onClose();
  };

  const messageLabel =
    messageIds.length === 1 ? "1 mensaje" : `${messageIds.length} mensajes`;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Cerrar"
        onClick={onClose}
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] shadow-2xl animate-fade-in max-h-[min(640px,calc(100vh-2rem))]">
        <div className="flex items-center justify-between border-b border-[var(--color-border-primary)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Reenviar mensaje
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {messageLabel} · misma bandeja de WhatsApp
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[var(--color-border-primary)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contacto o teléfono"
              className="w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {eligibleConversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
              {search.trim()
                ? "No hay contactos que coincidan con la búsqueda"
                : "No hay otras conversaciones en esta bandeja"}
            </div>
          ) : (
            <ul className="py-1">
              {eligibleConversations.map((conversation) => {
                const selected = selectedIds.includes(conversation.id);
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => toggleTarget(conversation.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-hover)]",
                        selected && "bg-[var(--color-brand)]/10"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          selected
                            ? "border-[var(--control-selected-fg)] bg-[var(--control-selected-bg)] text-[var(--control-selected-fg)]"
                            : "border-[var(--color-border-primary)]"
                        )}
                      >
                        {selected ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {conversation.contact.name}
                        </span>
                        <span className="block truncate text-xs text-[var(--color-text-muted)]">
                          {formatLocalWhatsAppPhoneDisplay(conversation.contact.phone ?? "")}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-primary)] px-4 py-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {selectedIds.length === 0
              ? "Selecciona uno o más chats"
              : selectedIds.length === 1
                ? "1 chat seleccionado"
                : `${selectedIds.length} chats seleccionados`}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Forward className="h-4 w-4" />
            Reenviar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
