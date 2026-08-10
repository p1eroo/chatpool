import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { downloadFile } from "@/lib/messageAttachments";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

function getImageFileName(message: Message): string {
  return message.fileName || message.content || "Imagen";
}

export function ImageLightbox() {
  const lightboxMessageId = useUIStore((s) => s.lightboxMessageId);
  const closeLightbox = useUIStore((s) => s.closeLightbox);
  const openLightbox = useUIStore((s) => s.openLightbox);

  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const allMessages = useConversationStore((s) => s.messages);

  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const showToast = useUIStore((s) => s.showToast);

  const imageMessages = useMemo(() => {
    if (!activeConversationId) return [];
    const messages = allMessages[activeConversationId] || [];
    return messages.filter(
      (message) => message.contentType === "image" && message.fileUrl
    );
  }, [activeConversationId, allMessages]);

  const currentIndex = useMemo(() => {
    if (!lightboxMessageId) return -1;
    return imageMessages.findIndex((message) => message.id === lightboxMessageId);
  }, [imageMessages, lightboxMessageId]);

  const currentMessage =
    currentIndex >= 0 ? imageMessages[currentIndex] : null;

  useEffect(() => {
    setScale(1);
    setRotation(0);
  }, [lightboxMessageId]);

  useEffect(() => {
    if (!lightboxMessageId) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
        return;
      }

      if (e.key === "ArrowLeft" && currentIndex > 0) {
        openLightbox(imageMessages[currentIndex - 1].id);
      }

      if (e.key === "ArrowRight" && currentIndex < imageMessages.length - 1) {
        openLightbox(imageMessages[currentIndex + 1].id);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    lightboxMessageId,
    closeLightbox,
    currentIndex,
    imageMessages,
    openLightbox,
  ]);

  if (!lightboxMessageId || !currentMessage?.fileUrl) return null;

  const fileName = getImageFileName(currentMessage);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < imageMessages.length - 1;

  const goPrev = () => {
    if (!hasPrev) return;
    openLightbox(imageMessages[currentIndex - 1].id);
  };

  const goNext = () => {
    if (!hasNext) return;
    openLightbox(imageMessages[currentIndex + 1].id);
  };

  const handleDownload = () => {
    if (downloading) return;
    setDownloading(true);
    void downloadFile({
      fileName,
      attachmentUrl: currentMessage.attachmentUrl,
      fileUrl: currentMessage.fileUrl,
    })
      .catch((error) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "No se pudo descargar la imagen";
        showToast(message);
      })
      .finally(() => setDownloading(false));
  };

  return createPortal(
    <div data-modal-overlay className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-x-0 top-0 z-10 flex h-12 items-center justify-center border-b border-white/10 bg-black/45 px-14">
        <p className="max-w-[50%] truncate text-sm text-white/90">{fileName}</p>

        <div className="absolute right-3 flex items-center gap-0.5">
          <ToolbarButton
            title="Acercar"
            onClick={() => setScale((value) => Math.min(MAX_SCALE, value + SCALE_STEP))}
          >
            <ZoomIn className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            title="Alejar"
            onClick={() => setScale((value) => Math.max(MIN_SCALE, value - SCALE_STEP))}
          >
            <ZoomOut className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            title="Girar a la izquierda"
            onClick={() => setRotation((value) => value - 90)}
          >
            <RotateCcw className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            title="Girar a la derecha"
            onClick={() => setRotation((value) => value + 90)}
          >
            <RotateCw className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            title={downloading ? "Descargando…" : "Descargar"}
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton title="Cerrar" onClick={closeLightbox}>
            <X className="w-[18px] h-[18px]" />
          </ToolbarButton>
        </div>
      </div>

      {hasPrev && (
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70"
          title="Imagen anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70"
          title="Imagen siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <div className="flex h-full items-center justify-center px-16 pb-16 pt-12">
        <img
          src={currentMessage.fileUrl}
          alt={fileName}
          className="max-h-full max-w-full object-contain transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>

      {imageMessages.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs tabular-nums text-white/90">
          {currentIndex + 1} / {imageMessages.length}
        </div>
      )}
    </div>,
    document.body
  );
}

function ToolbarButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}
