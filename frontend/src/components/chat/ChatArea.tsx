import { useCallback, useRef, useState } from "react";
import { useHasPermission } from "@/hooks/useAgentPermissions";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { getClipboardAttachmentFile, isAcceptedAttachmentFile } from "@/lib/attachmentUtils";
import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";
import { WhatsAppReplyWindowBanner } from "./WhatsAppReplyWindowBanner";
import { ImageLightbox } from "./ImageLightbox";
import { ForwardMessagesModal } from "./ForwardMessagesModal";
import { isWhatsAppReplyWindowClosed } from "@/lib/whatsappReplyWindow";
import { Paperclip } from "lucide-react";

export function ChatArea() {
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const conversations = useConversationStore((s) => s.conversations);
  const messages = useConversationStore((s) => s.messages);
  const messagesLoading = useConversationStore((s) => s.messagesLoading);
  const toast = useUIStore((s) => s.toast);
  const noteAboutMessage = useUIStore((s) => s.noteAboutMessage);
  const requestAttachFile = useUIStore((s) => s.requestAttachFile);
  const showToast = useUIStore((s) => s.showToast);
  const forwardSelectionMode = useUIStore((s) => s.forwardSelectionMode);
  const forwardModalOpen = useUIStore((s) => s.forwardModalOpen);
  const forwardSourceConversationId = useUIStore((s) => s.forwardSourceConversationId);
  const forwardSelectedMessageIds = useUIStore((s) => s.forwardSelectedMessageIds);
  const closeForwardModal = useUIStore((s) => s.closeForwardModal);
  const canSendMessages = useHasPermission("sendMessages");

  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const activeConversation = activeConversationId
    ? conversations.find((conversation) => conversation.id === activeConversationId) ?? null
    : null;

  const activeMessages = activeConversationId ? messages[activeConversationId] ?? [] : [];

  const isLoadingMessages = Boolean(
    activeConversationId && messagesLoading[activeConversationId]
  );

  const whatsAppWindowClosed =
    Boolean(activeConversationId) &&
    !isLoadingMessages &&
    isWhatsAppReplyWindowClosed(activeConversation?.channelType, activeMessages);

  const canAcceptDrop =
    Boolean(activeConversationId) &&
    !isLoadingMessages &&
    !whatsAppWindowClosed &&
    canSendMessages;

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

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!canAcceptDrop) return;

      // El composer ya maneja Ctrl+V cuando el foco está en el textarea.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("textarea, input")) return;

      const file = getClipboardAttachmentFile(e.clipboardData);
      if (!file) return;

      e.preventDefault();

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
      onPaste={handlePaste}
    >
      <MessageList />
      {activeConversationId && !isLoadingMessages && !forwardSelectionMode &&
        (whatsAppWindowClosed ? (
          <WhatsAppReplyWindowBanner conversationId={activeConversationId} />
        ) : canSendMessages ? (
          <ChatComposer />
        ) : (
          <div className="shrink-0 border-t border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 py-3">
            <p className="text-xs text-[var(--color-text-muted)] text-center">
              No tienes permiso para enviar mensajes en esta bandeja.
            </p>
          </div>
        ))}
      <ImageLightbox />
      <ForwardMessagesModal
        open={forwardModalOpen}
        sourceConversationId={forwardSourceConversationId}
        messageIds={forwardSelectedMessageIds}
        onClose={closeForwardModal}
      />

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
