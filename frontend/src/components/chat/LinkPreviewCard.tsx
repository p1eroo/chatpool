import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeUrlForHref } from "@/lib/detectUrls";
import type { LinkPreview } from "@/types";

interface LinkPreviewCardProps {
  preview: LinkPreview;
  variant?: "composer" | "incoming" | "outgoing";
  loading?: boolean;
  onDismiss?: () => void;
}

function getHostname(url: string): string {
  try {
    return new URL(normalizeUrlForHref(url)).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function PreviewTextBlock({
  preview,
  domain,
  loading,
  isOutgoing,
  compact,
}: {
  preview: LinkPreview;
  domain: string;
  loading: boolean;
  isOutgoing: boolean;
  compact?: boolean;
}) {
  if (loading && !preview.title) {
    return (
      <div className="space-y-2 animate-chat-skeleton min-w-0 flex-1" aria-hidden>
        <div className="h-3 w-4/5 rounded bg-black/10 dark:bg-white/10" />
        <div className="h-2.5 w-full rounded bg-black/10 dark:bg-white/10" />
        {!compact ? (
          <div className="h-2.5 w-2/3 rounded bg-black/10 dark:bg-white/10" />
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      {preview.title ? (
        <p
          className={cn(
            "font-semibold leading-snug line-clamp-2",
            compact ? "text-[13px]" : "text-sm",
            isOutgoing ? "text-white" : "text-[var(--color-text-primary)]"
          )}
        >
          {preview.title}
        </p>
      ) : null}
      {preview.description ? (
        <p
          className={cn(
            "mt-0.5 leading-relaxed line-clamp-2",
            compact ? "text-[11px]" : "text-xs",
            isOutgoing ? "text-white/75" : "text-[var(--color-text-secondary)]"
          )}
        >
          {preview.description}
        </p>
      ) : null}
      <p
        className={cn(
          "mt-1.5 flex items-center gap-1 truncate",
          compact ? "text-[10px]" : "text-[11px]",
          isOutgoing ? "text-white/60" : "text-[var(--color-text-muted)]"
        )}
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        <span className="truncate">{domain}</span>
      </p>
    </div>
  );
}

function PreviewThumbnail({
  preview,
  loading,
  horizontal,
}: {
  preview: LinkPreview;
  loading: boolean;
  horizontal?: boolean;
}) {
  if (preview.imageUrl) {
    return (
      <div
        className={cn(
          "shrink-0 overflow-hidden bg-black/5",
          horizontal ? "h-[72px] w-[72px] rounded-md" : "w-full max-h-40"
        )}
      >
        <img
          src={preview.imageUrl}
          alt=""
          className={cn("object-cover", horizontal ? "h-full w-full" : "h-full w-full max-h-40")}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          "animate-chat-skeleton bg-black/5 shrink-0",
          horizontal ? "h-[72px] w-[72px] rounded-md" : "h-20 w-full"
        )}
      />
    );
  }

  return null;
}

export function LinkPreviewCard({
  preview,
  variant = "incoming",
  loading = false,
  onDismiss,
}: LinkPreviewCardProps) {
  const href = normalizeUrlForHref(preview.url);
  const domain = preview.siteName?.trim() || getHostname(preview.url);
  const isComposer = variant === "composer";
  const isOutgoing = variant === "outgoing";

  const content = isComposer ? (
    <div className="flex items-stretch gap-3 p-3 pr-10">
      <PreviewThumbnail preview={preview} loading={loading} horizontal />
      <PreviewTextBlock
        preview={preview}
        domain={domain}
        loading={loading}
        isOutgoing={false}
        compact
      />
    </div>
  ) : (
    <>
      <PreviewThumbnail preview={preview} loading={loading} />
      <div className="px-3 py-2.5">
        <PreviewTextBlock
          preview={preview}
          domain={domain}
          loading={loading}
          isOutgoing={isOutgoing}
        />
      </div>
    </>
  );

  if (isComposer) {
    return (
      <div className="relative mb-2 overflow-hidden rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]">
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60"
            aria-label="Quitar vista previa"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <a href={href} target="_blank" rel="noopener noreferrer" className="block">
          {content}
        </a>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "mb-2 block overflow-hidden rounded-lg border transition-opacity hover:opacity-95",
        isOutgoing
          ? "border-white/20 bg-black/15"
          : "border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]/70"
      )}
    >
      {content}
    </a>
  );
}
