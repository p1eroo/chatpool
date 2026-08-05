import { useState } from "react";
import { Plus, X } from "lucide-react";
import { FileAttachmentCard } from "@/components/chat/FileAttachmentCard";
import { ComposerAttachmentPreview } from "@/components/chat/ComposerAttachmentPreview";
import { MAX_PENDING_IMAGES } from "@/lib/attachmentUtils";
import { cn } from "@/lib/utils";

export interface ComposerPendingAttachment {
  id: string;
  file: File;
  url: string;
}

interface ComposerPendingAttachmentsProps {
  attachments: ComposerPendingAttachment[];
  onRemove: (id: string) => void;
  onAddImages: () => void;
}

export function ComposerPendingAttachments({
  attachments,
  onRemove,
  onAddImages,
}: ComposerPendingAttachmentsProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  const allImages = attachments.every((item) => item.file.type.startsWith("image/"));
  const canAddMore = allImages && attachments.length < MAX_PENDING_IMAGES;

  if (!allImages) {
    const item = attachments[0];
    return (
      <div className="mb-2 px-1">
        <FileAttachmentCard
          fileName={item.file.name}
          fileSize={item.file.size}
          variant="composer"
          onRemove={() => onRemove(item.id)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 px-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {attachments.map((item) => (
            <div key={item.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPreviewId(item.id)}
                className="block rounded-xl overflow-hidden border border-[var(--color-border-primary)] hover:ring-2 hover:ring-[var(--color-brand)]/40 transition-shadow"
                title="Ver vista previa"
              >
                <img
                  src={item.url}
                  alt={item.file.name}
                  className="h-24 w-24 object-cover"
                  draggable={false}
                />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shadow-sm"
                title="Quitar imagen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {canAddMore && (
            <button
              type="button"
              onClick={onAddImages}
              title="Agregar más imágenes"
              className={cn(
                "shrink-0 h-24 w-24 rounded-xl border-2 border-dashed border-[var(--color-border-primary)]",
                "flex flex-col items-center justify-center gap-1 text-[var(--color-text-muted)]",
                "hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
              )}
            >
              <Plus className="w-6 h-6" />
              <span className="text-[10px] font-medium">
                {attachments.length}/{MAX_PENDING_IMAGES}
              </span>
            </button>
          )}
        </div>
      </div>

      {previewId && (
        <ComposerAttachmentPreview
          attachments={attachments}
          initialId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </>
  );
}
