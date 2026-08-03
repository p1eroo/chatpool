import { cn } from "@/lib/utils";

function SkeletonBubble({
  align,
  delayMs,
  widthClass,
  lines = 1,
}: {
  align: "start" | "end";
  delayMs: number;
  widthClass: string;
  lines?: 1 | 2;
}) {
  return (
    <div className={cn("flex w-full", align === "start" ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "rounded-2xl px-4 py-3.5 animate-chat-skeleton space-y-2.5",
          widthClass,
          align === "start"
            ? "rounded-tl-md bg-[var(--color-bubble-in)]"
            : "rounded-tr-md bg-[color-mix(in_srgb,var(--color-brand)_28%,var(--color-bg-tertiary))]"
        )}
        style={{ animationDelay: `${delayMs}ms` }}
      >
        <div
          className={cn(
            "h-2.5 rounded-full",
            align === "start" ? "bg-black/10 dark:bg-white/10" : "bg-black/10 dark:bg-white/15",
            lines === 2 ? "w-full" : "w-[88%]"
          )}
        />
        {lines === 2 ? (
          <div
            className={cn(
              "h-2.5 w-[62%] rounded-full",
              align === "start" ? "bg-black/10 dark:bg-white/10" : "bg-black/10 dark:bg-white/15"
            )}
          />
        ) : null}
      </div>
    </div>
  );
}

function LoadingContent({
  message,
  showSkeleton,
}: {
  message: string;
  showSkeleton: boolean;
}) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center justify-center gap-10 px-6 animate-fade-in">
      {showSkeleton ? (
        <div
          className="w-full space-y-4 pointer-events-none select-none sm:space-y-5"
          aria-hidden
        >
          <SkeletonBubble align="start" widthClass="w-[min(100%,20rem)] sm:w-80" lines={2} delayMs={0} />
          <SkeletonBubble align="end" widthClass="w-[min(100%,16rem)] sm:w-64" lines={1} delayMs={120} />
          <SkeletonBubble align="start" widthClass="w-[min(100%,13rem)] sm:w-52" lines={1} delayMs={240} />
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-[var(--color-brand)]/15" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-brand)] animate-spin" />
          <span className="flex gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce-dot"
              style={{ animationDelay: "0s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce-dot"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce-dot"
              style={{ animationDelay: "0.3s" }}
            />
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
      </div>
    </div>
  );
}

interface AppLoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  showSkeleton?: boolean;
}

export function AppLoadingState({
  message = "Cargando…",
  fullScreen = false,
  showSkeleton = true,
}: AppLoadingStateProps) {
  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-bg-primary)]">
        <LoadingContent message={message} showSkeleton={showSkeleton} />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <LoadingContent message={message} showSkeleton={showSkeleton} />
      </div>
    </div>
  );
}
