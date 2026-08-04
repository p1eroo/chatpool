import { Download, Paperclip, X } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import {
  getFileTypeBadgeStyle,
  getFileTypeLabel,
  splitFileName,
  usesPaperclipIcon,
} from "@/lib/fileUtils";
import { downloadFile } from "@/lib/messageAttachments";
import { useUIStore } from "@/store/uiStore";

interface FileAttachmentCardProps {
  fileName: string;
  fileSize?: number;
  fileUrl?: string;
  attachmentUrl?: string;
  variant?: "outgoing" | "incoming" | "composer";
  onRemove?: () => void;
}

export function FileAttachmentCard({
  fileName,
  fileSize,
  fileUrl,
  attachmentUrl,
  variant = "outgoing",
  onRemove,
}: FileAttachmentCardProps) {
  const { base, extension } = splitFileName(fileName);
  const typeLabel = getFileTypeLabel(extension);
  const typeBadge = getFileTypeBadgeStyle(extension, variant === "outgoing");
  const isOutgoing = variant === "outgoing";
  const showPaperclip = usesPaperclipIcon(extension);
  const canDownload = Boolean(fileUrl || attachmentUrl);
  const showToast = useUIStore((s) => s.showToast);

  const handleDownload = async () => {
    if (!fileUrl && !attachmentUrl) return;

    try {
      await downloadFile({ fileName, attachmentUrl, fileUrl });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "No se pudo descargar el archivo. Pide al contacto que lo reenvíe.";
      showToast(message);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-3 min-w-[248px] max-w-[300px]",
        variant === "outgoing" && "bg-transparent border-white/25",
        variant === "incoming" &&
          "bg-[var(--color-bg-primary)] border-[var(--color-border-primary)]",
        variant === "composer" &&
          "bg-[var(--color-bg-primary)] border-[var(--color-border-primary)]"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
          showPaperclip
            ? isOutgoing
              ? "bg-white/12"
              : "bg-[var(--color-bg-hover)]"
            : cn("text-[10px] font-bold tracking-wide", typeBadge.badge),
          !showPaperclip && isOutgoing && !extension && "bg-white/12 text-white/90"
        )}
        title={typeLabel}
      >
        {showPaperclip ? (
          <Paperclip
            className={cn(
              "w-[18px] h-[18px]",
              isOutgoing ? "text-[#c8e6c9]" : "text-[var(--color-text-secondary)]"
            )}
            strokeWidth={1.75}
          />
        ) : (
          typeBadge.label
        )}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <div
          className={cn(
            "flex items-baseline min-w-0 text-[13px] leading-snug",
            isOutgoing ? "text-white/95" : "text-[var(--color-text-primary)]"
          )}
        >
          <span className="truncate">{base || fileName}</span>
          {extension && (
            <span className="shrink-0">.{extension}</span>
          )}
        </div>
        <p
          className={cn(
            "text-[11px] mt-0.5 leading-none",
            isOutgoing ? "text-white/50" : "text-[var(--color-text-muted)]"
          )}
        >
          {typeLabel}
          {fileSize !== undefined && ` · ${formatFileSize(fileSize)}`}
        </p>
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-md shrink-0 transition-colors",
            isOutgoing
              ? "text-white/50 hover:text-white/90"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          )}
          title="Quitar archivo"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={!canDownload}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-md shrink-0 transition-colors disabled:opacity-35 disabled:cursor-not-allowed",
            isOutgoing
              ? "text-white/55 hover:text-white/90"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          )}
          title="Descargar"
        >
          <Download className="w-[17px] h-[17px]" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
