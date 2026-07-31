import { useState, useRef, useCallback, useEffect } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import {
  Smile,
  Paperclip,
  Zap,
  Send,
  StickyNote,
  MessageSquare,
  CornerUpLeft,
  X,
} from "lucide-react";

export function ChatComposer() {
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const { isNoteMode, toggleNoteMode, replyToMessage, setReplyToMessage, noteAboutMessage, setNoteAboutMessage } =
    useUIStore();
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyToMessage || noteAboutMessage) {
      textareaRef.current?.focus();
    }
  }, [replyToMessage, noteAboutMessage]);

  useEffect(() => {
    setReplyToMessage(null);
    setNoteAboutMessage(null);
  }, [activeConversationId, setReplyToMessage, setNoteAboutMessage]);

  const handleSend = useCallback(() => {
    if (!content.trim() || !activeConversationId) return;
    sendMessage(
      activeConversationId,
      content.trim(),
      isNoteMode,
      {
        attachedToMessageId: isNoteMode ? noteAboutMessage?.id : undefined,
        replyToMessageId: !isNoteMode ? replyToMessage?.id : undefined,
      }
    );
    setContent("");
    setReplyToMessage(null);
    setNoteAboutMessage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content, activeConversationId, isNoteMode, noteAboutMessage, replyToMessage, sendMessage, setReplyToMessage, setNoteAboutMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  return (
    <div
      className={cn(
        "border-t border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-3",
        isNoteMode && "border-t-amber-500/30"
      )}
    >
      {isNoteMode && (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <StickyNote className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-amber-400 font-medium">Nota privada — solo visible para agentes</span>
        </div>
      )}

      {noteAboutMessage && isNoteMode && (
        <div className="flex items-start gap-2 mb-2 px-1 py-2 rounded-lg bg-[var(--color-note-bg)] border-l-[3px] border-amber-500/60">
          <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-amber-400 mb-0.5">
              Nota sobre mensaje de {noteAboutMessage.senderName || "contacto"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] truncate">
              {noteAboutMessage.content}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNoteAboutMessage(null)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors shrink-0"
            title="Cancelar nota"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {replyToMessage && !isNoteMode && (
        <div className="flex items-start gap-2 mb-2 px-1 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border-l-[3px] border-[var(--color-brand)]">
          <CornerUpLeft className="w-3.5 h-3.5 text-[var(--color-brand)] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-[var(--color-brand)] mb-0.5">
              Respondiendo a {replyToMessage.senderName || "mensaje"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] truncate">
              {replyToMessage.content}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyToMessage(null)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors shrink-0"
            title="Cancelar respuesta"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 flex items-end bg-[var(--color-bg-tertiary)] rounded-xl border border-transparent focus-within:border-[var(--color-brand)] transition-colors">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={isNoteMode ? "Escribe una nota privada..." : "Escribe un mensaje..."}
            rows={1}
            className="flex-1 bg-transparent text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] resize-none outline-none px-3 py-2.5 max-h-[120px]"
          />

          <div className="flex items-center gap-0.5 pr-1 pb-1.5">
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              title="Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              title="Adjuntar archivo"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              title="Respuestas guardadas"
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleNoteMode}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-xl transition-colors",
              isNoteMode
                ? "bg-amber-500/20 text-amber-400"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
            )}
            title={isNoteMode ? "Modo respuesta" : "Modo nota privada"}
          >
            {isNoteMode ? (
              <StickyNote className="w-4 h-4" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleSend}
            disabled={!content.trim()}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--color-brand)] text-white transition-all",
              !content.trim() ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--color-brand-light)] active:scale-95"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
