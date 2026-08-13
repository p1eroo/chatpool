import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CornerUpLeft,
  Copy,
  Forward,
  RefreshCw,
  SmilePlus,
  StickyNote,
} from "lucide-react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { useSaveStickerFromMessage } from "@/hooks/useSavedStickers";
import { isForwardableMessage } from "@/lib/forwardMessages";
import type { Message } from "@/types";
import { ApiError } from "@/api/errors";

interface MessageContextMenuProps {
  message: Message;
  conversationId: string;
  x: number;
  y: number;
  onClose: () => void;
}

interface MenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}

function MenuItem({ icon: Icon, label, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
    >
      <Icon className="w-4 h-4 shrink-0 text-[var(--color-text-secondary)]" />
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

export function MessageContextMenu({
  message,
  conversationId,
  x,
  y,
  onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  const retryFailedMessage = useConversationStore((s) => s.retryFailedMessage);
  const setReplyToMessage = useUIStore((s) => s.setReplyToMessage);
  const setNoteAboutMessage = useUIStore((s) => s.setNoteAboutMessage);
  const showToast = useUIStore((s) => s.showToast);
  const beginForwardSelection = useUIStore((s) => s.beginForwardSelection);
  const saveSticker = useSaveStickerFromMessage();

  const canForward = isForwardableMessage(message);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const padding = 8;
    let nextX = x;
    let nextY = y;

    if (nextX + rect.width > window.innerWidth - padding) {
      nextX = window.innerWidth - rect.width - padding;
    }
    if (nextY + rect.height > window.innerHeight - padding) {
      nextY = window.innerHeight - rect.height - padding;
    }

    setPosition({
      x: Math.max(padding, nextX),
      y: Math.max(padding, nextY),
    });
  }, [x, y]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onClose]);

  const runAction = (action: () => void) => {
    action();
    onClose();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Mensaje copiado");
    } catch {
      showToast("No se pudo copiar al portapapeles");
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[240px] rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] py-1 shadow-xl animate-fade-in"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItem
        icon={CornerUpLeft}
        label="Responder a este mensaje"
        onClick={() =>
          runAction(() => {
            setNoteAboutMessage(null);
            setReplyToMessage(message);
          })
        }
      />
      <MenuItem
        icon={Copy}
        label="Copiar"
        onClick={() =>
          runAction(() => {
            void copyToClipboard(message.content);
          })
        }
      />
      <MenuItem
        icon={StickyNote}
        label="Añadir nota privada"
        onClick={() =>
          runAction(() => {
            setReplyToMessage(null);
            setNoteAboutMessage(message);
          })
        }
      />

      {canForward && (
        <MenuItem
          icon={Forward}
          label="Reenviar"
          onClick={() =>
            runAction(() => {
              beginForwardSelection(conversationId, message.id);
            })
          }
        />
      )}

      {message.contentType === "sticker" && (
        <MenuItem
          icon={SmilePlus}
          label="Guardar sticker"
          onClick={() =>
            runAction(() => {
              void saveSticker
                .mutateAsync({ conversationId, messageId: message.id })
                .then(() => showToast("Sticker guardado"))
                .catch((error) => {
                  const text =
                    error instanceof ApiError
                      ? error.message
                      : error instanceof Error
                        ? error.message
                        : "No se pudo guardar el sticker";
                  showToast(text);
                });
            })
          }
        />
      )}

      {message.senderType === "agent" && message.status === "failed" && !message.isPrivate && (
        <MenuItem
          icon={RefreshCw}
          label="Reintentar envío"
          onClick={() =>
            runAction(() => {
              void retryFailedMessage(conversationId, message.id);
            })
          }
        />
      )}
    </div>,
    document.body
  );
}
