import { useCallback, useRef, useState } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { isAcceptedAttachmentFile } from "@/lib/attachmentUtils";
import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";
import { WhatsAppReplyWindowBanner } from "./WhatsAppReplyWindowBanner";
import { ImageLightbox } from "./ImageLightbox";
import { isWhatsAppReplyWindowClosed } from "@/lib/whatsappReplyWindow";
import { Paperclip } from "lucide-react";

export function ChatArea() {
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const conversations = useConversationStore((s) => s.conversations);
  const messages = useConversationStore((s) => s.messages);
  const templateWindowOverrides = useConversationStore((s) => s.templateWindowOverrides);
  const toast = useUIStore((s) => s.toast);
  const noteAboutMessage = useUIStore((s) => s.noteAboutMessage);
  const requestAttachFile = useUIStore((s) => s.requestAttachFile);
  const showToast = useUIStore((s) => s.showToast);

  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const activeConversation = activeConversationId
    ? conversations.find((conversation) => conversation.id === activeConversationId) ?? null
    : null;

  const activeMessages = activeConversationId ? messages[activeConversationId] ?? [] : [];

  const whatsAppWindowClosed =
    Boolean(activeConversationId) &&
    isWhatsAppReplyWindowClosed(activeConversation?.channelType, activeMessages, {
      templateUnlocked: activeConversationId
        ? templateWindowOverrides[activeConversationId]
        : false,
    });

  const canAcceptDrop = Boolean(activeConversationId) && !whatsAppWindowClosed;

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!canAcceptDrop || !e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDragging(true);
    },
    [canAcceptDrop]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!canAcceptDrop || !e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    [canAcceptDrop]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (!canAcceptDrop) return;

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      if (noteAboutMessage) {
        showToast("No puedes adjuntar archivos en una nota privada");
        return;
      }

      if (!isAcceptedAttachmentFile(file)) {
        showToast("Tipo de archivo no soportado");
        return;
      }

      requestAttachFile(file);
    },
    [canAcceptDrop, noteAboutMessage, requestAttachFile, showToast]
  );

  return (
    <div
      className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-primary)] h-screen relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <MessageList />
      {activeConversationId &&
        (whatsAppWindowClosed ? (
          <WhatsAppReplyWindowBanner conversationId={activeConversationId} />
        ) : (
          <ChatComposer />
        ))}
      <ImageLightbox />

      {isDragging && activeConversationId && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--color-bg-primary)]/85 border-2 border-dashed border-[var(--color-brand)] pointer-events-none animate-fade-in">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand)]/15 flex items-center justify-center">
              <Paperclip className="w-7 h-7 text-[var(--color-brand)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Suelta el archivo para adjuntarlo
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Imágenes, PDF, Word, Excel y más
              </p>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] text-sm text-[var(--color-text-primary)] shadow-xl animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
