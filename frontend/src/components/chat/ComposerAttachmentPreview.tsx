import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComposerPendingAttachment } from "@/components/chat/ComposerPendingAttachments";

interface ComposerAttachmentPreviewProps {
  attachments: ComposerPendingAttachment[];
  initialId: string;
  onClose: () => void;
}

export function ComposerAttachmentPreview({
  attachments,
  initialId,
  onClose,
}: ComposerAttachmentPreviewProps) {
  const [activeId, setActiveId] = useState(initialId);

  const activeIndex = attachments.findIndex((item) => item.id === activeId);
  const current = activeIndex >= 0 ? attachments[activeIndex] : attachments[0];

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "ArrowLeft" && activeIndex > 0) {
        setActiveId(attachments[activeIndex - 1].id);
      }

      if (e.key === "ArrowRight" && activeIndex < attachments.length - 1) {
        setActiveId(attachments[activeIndex + 1].id);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, attachments, onClose]);

  if (!current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa de imagen"
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <p className="text-sm text-white/80 truncate max-w-[60%]">
          {current.file.name}
        </p>
        <div className="flex items-center gap-2">
          {attachments.length > 1 && (
            <span className="text-xs text-white/60 tabular-nums">
              {activeIndex + 1} / {attachments.length}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10 transition-colors"
            aria-label="Cerrar vista previa"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        className="relative flex-1 flex items-center justify-center px-4 pb-6 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {activeIndex > 0 && (
          <button
            type="button"
            onClick={() => setActiveId(attachments[activeIndex - 1].id)}
            className="absolute left-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Imagen anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <img
          src={current.url}
          alt={current.file.name}
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          draggable={false}
        />

        {activeIndex < attachments.length - 1 && (
          <button
            type="button"
            onClick={() => setActiveId(attachments[activeIndex + 1].id)}
            className="absolute right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Imagen siguiente"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {attachments.length > 1 && (
        <div className="flex justify-center gap-2 px-4 pb-4 shrink-0">
          {attachments.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveId(item.id);
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index === activeIndex ? "bg-white" : "bg-white/35 hover:bg-white/55"
              )}
              aria-label={`Ver imagen ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
