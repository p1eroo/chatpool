import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bell, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAnchoredFixedPosition } from "@/hooks/useAnchoredFixedPosition";
import { useConversationStore } from "@/store/conversationStore";
import { useInboxStore } from "@/store/inboxStore";
import { cn, formatTime } from "@/lib/utils";

interface NotificationsPopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function NotificationsPopover({ open, anchorRef, onClose }: NotificationsPopoverProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const conversations = useConversationStore((s) => s.conversations);
  const openConversation = useConversationStore((s) => s.openConversation);
  const getInboxById = useInboxStore((s) => s.getInboxById);

  const unreadConversations = useMemo(
    () =>
      conversations
        .filter((c) => c.unreadCount > 0)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [conversations]
  );

  const position = useAnchoredFixedPosition(open, anchorRef, {
    placement: "above-right",
    offsetX: 8,
    offsetY: 8,
  });

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !position) return null;

  const handleOpenConversation = (conversationId: string) => {
    openConversation(conversationId);
    navigate("/inbox");
    onClose();
  };

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[120] w-[320px] max-h-[min(420px,70vh)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-2xl overflow-hidden animate-fade-in"
      style={{
        left: position.left,
        bottom: position.bottom,
      }}
    >
      <div className="px-4 py-3 border-b border-[var(--color-border-primary)] flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Notificaciones</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {unreadConversations.length === 0
              ? "Sin mensajes nuevos"
              : `${unreadConversations.length} conversación${unreadConversations.length === 1 ? "" : "es"} sin leer`}
          </p>
        </div>
        <Badge count={unreadConversations.reduce((sum, c) => sum + c.unreadCount, 0)} />
      </div>

      <div className="overflow-y-auto max-h-[min(360px,calc(70vh-56px))]">
        {unreadConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-3">
              <Bell className="w-5 h-5 text-[var(--color-text-muted)] opacity-60" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">Todo al día</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              Los mensajes nuevos aparecerán aquí.
            </p>
          </div>
        ) : (
          unreadConversations.map((conversation) => {
            const inbox = getInboxById(conversation.inboxId);
            const preview = conversation.lastMessage?.content?.slice(0, 72) || "Nuevo mensaje";
            const time = conversation.lastMessage
              ? formatTime(conversation.lastMessage.createdAt)
              : formatTime(conversation.updatedAt);

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => handleOpenConversation(conversation.id)}
                className="w-full text-left px-4 py-3 border-b border-[var(--color-border-primary)] last:border-b-0 hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={conversation.contact.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {conversation.contact.name}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                        {time}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                      {preview}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {inbox && (
                        <span className="text-[10px] text-[var(--color-text-muted)] truncate">
                          {inbox.name}
                        </span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-brand)]">
                        <MessageSquare className="w-3 h-3" />
                        {conversation.unreadCount}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );
}

interface NotificationsButtonProps {
  count: number;
  open: boolean;
  onToggle: () => void;
  itemColor: string;
  hoverBg: string;
}

export function NotificationsButton({
  count,
  open,
  onToggle,
  itemColor,
  hoverBg,
}: NotificationsButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-xl transition-colors relative",
        open && "bg-[var(--color-brand)] text-white"
      )}
      style={open ? undefined : { color: itemColor }}
      onMouseEnter={(e) => {
        if (!open) {
          e.currentTarget.style.backgroundColor = hoverBg;
          e.currentTarget.style.color = "white";
        }
      }}
      onMouseLeave={(e) => {
        if (!open) {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = itemColor;
        }
      }}
      title="Notificaciones"
      aria-expanded={open}
    >
      <Bell className="w-4 h-4" />
      <Badge count={count} className="absolute -top-0.5 -right-0.5" />
    </button>
  );
}
