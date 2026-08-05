import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CannedResponse } from "@/types";

interface CannedSlashMenuProps {
  items: CannedResponse[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (item: CannedResponse) => void;
}

export function CannedSlashMenu({
  items,
  activeIndex,
  onHover,
  onSelect,
}: CannedSlashMenuProps) {
  if (items.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-2 z-40 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] shadow-xl px-4 py-3 animate-fade-in">
        <p className="text-sm text-[var(--color-text-muted)]">
          No hay respuestas que coincidan
        </p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-40 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] shadow-xl overflow-hidden animate-fade-in">
      <div className="px-3 py-2 border-b border-[var(--color-border-primary)]">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Respuestas predefinidas
        </p>
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {items.map((item, index) => {
          const hasImage = Boolean(item.fileUrl || item.attachmentUrl);
          return (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => onHover(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
              className={cn(
                "w-full px-3 py-2 text-left transition-colors",
                index === activeIndex
                  ? "bg-[var(--color-bg-hover)]"
                  : "hover:bg-[var(--color-bg-hover)]"
              )}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  /{item.title}
                </p>
                {hasImage && (
                  <ImageIcon className="w-3.5 h-3.5 text-[var(--color-brand)] shrink-0" />
                )}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">
                {item.content.trim() || (hasImage ? "Imagen adjunta" : "")}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
