import { cn, formatFileSize } from "@/lib/utils";
import {
  getFileTypeBadgeStyle,
  getFileTypeLabel,
  splitFileName,
} from "@/lib/fileUtils";
import { useAttachmentBlob } from "@/hooks/useAttachmentBlob";
import { usePdfThumbnail } from "@/hooks/usePdfThumbnail";
import { useUIStore } from "@/store/uiStore";

interface PdfAttachmentCardProps {
  messageId: string;
  fileName: string;
  fileSize?: number;
  fileUrl?: string;
  attachmentUrl?: string;
  variant?: "outgoing" | "incoming";
}

const CARD_SHELL = {
  outgoing: "bg-[#0f432e]",
  incoming: "bg-[#d1d7db] dark:bg-[#3b4a54]",
} as const;

export function PdfAttachmentCard({
  messageId,
  fileName,
  fileSize,
  fileUrl,
  attachmentUrl,
  variant = "outgoing",
}: PdfAttachmentCardProps) {
  const openPdfViewer = useUIStore((s) => s.openPdfViewer);
  const { base, extension } = splitFileName(fileName);
  const typeLabel = getFileTypeLabel(extension);
  const typeBadge = getFileTypeBadgeStyle(extension, variant === "outgoing");
  const isOutgoing = variant === "outgoing";
  const canOpen = Boolean(fileUrl || attachmentUrl);
  const cardShell = isOutgoing ? CARD_SHELL.outgoing : CARD_SHELL.incoming;

  const { blob, loading: blobLoading, error: blobError } = useAttachmentBlob({
    attachmentUrl,
    fileUrl,
    enabled: canOpen,
  });

  const {
    thumbnailUrl,
    pageCount,
    loading: thumbLoading,
    error: thumbError,
  } = usePdfThumbnail(blob);

  const loading = blobLoading || thumbLoading;
  const previewUnavailable = Boolean(blobError || thumbError);

  const handleOpen = () => {
    if (!canOpen) return;
    openPdfViewer(messageId);
  };

  const pageLabel =
    pageCount === 1
      ? "1 página"
      : pageCount !== null
        ? `${pageCount} páginas`
        : null;

  const metadata = [pageLabel, typeLabel, fileSize !== undefined && formatFileSize(fileSize)]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={!canOpen}
      className={cn(
        "block w-[330px] max-w-full shrink-0 overflow-hidden rounded-lg p-[3px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.14)] transition-opacity",
        cardShell,
        canOpen
          ? "cursor-pointer select-none hover:opacity-95"
          : "cursor-not-allowed opacity-70"
      )}
      title={canOpen ? "Ver documento" : "Documento no disponible"}
    >
      <div className="relative h-[210px] w-full overflow-hidden rounded-[5px] bg-white">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          </div>
        )}

        {!loading && previewUnavailable && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-[10px] font-bold tracking-wide",
                typeBadge.badge
              )}
            >
              PDF
            </div>
            <p className="text-[11px] text-neutral-500">
              {blobError ?? "Vista previa no disponible"}
            </p>
          </div>
        )}

        {!loading && !previewUnavailable && thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            className="block h-full w-full object-cover object-top"
            draggable={false}
          />
        )}

        {!loading && !previewUnavailable && !thumbnailUrl && (
          <div className="flex h-full items-center justify-center">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-[10px] font-bold tracking-wide",
                typeBadge.badge
              )}
            >
              PDF
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-2.5 py-2.5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-wide",
            isOutgoing ? "bg-red-400/25 text-red-50" : typeBadge.badge
          )}
        >
          PDF
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "flex min-w-0 items-baseline text-[13px] leading-snug font-medium",
              isOutgoing
                ? "text-white/95"
                : "text-[#111b21] dark:text-white/95"
            )}
          >
            <span className="truncate">{base || fileName}</span>
            {extension && <span className="shrink-0">.{extension}</span>}
          </div>
          <p
            className={cn(
              "mt-0.5 text-[11px] leading-none",
              isOutgoing
                ? "text-white/55"
                : "text-[#667781] dark:text-white/55"
            )}
          >
            {metadata || typeLabel}
          </p>
        </div>
      </div>
    </button>
  );
}
