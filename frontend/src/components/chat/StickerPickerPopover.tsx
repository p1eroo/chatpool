import { Loader2, Trash2 } from "lucide-react";
import {
  useDeleteSavedSticker,
  useSavedStickers,
} from "@/hooks/useSavedStickers";
import { useUIStore } from "@/store/uiStore";
import type { SavedSticker } from "@/types";
import { ApiError } from "@/api/errors";
import { cn } from "@/lib/utils";

interface StickerPickerPopoverProps {
  onSelect: (sticker: SavedSticker) => void;
  disabled?: boolean;
}

export function StickerPickerPopover({ onSelect, disabled }: StickerPickerPopoverProps) {
  const showToast = useUIStore((s) => s.showToast);
  const { data: stickers = [], isLoading, isError, error } = useSavedStickers();
  const deleteSticker = useDeleteSavedSticker();

  const showLoading = isLoading && stickers.length === 0;
  const errorMessage =
    isError && error instanceof Error ? error.message : "No se pudieron cargar los stickers";

  const handleDelete = async (stickerId: string) => {
    try {
      await deleteSticker.mutateAsync(stickerId);
      showToast("Sticker eliminado");
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo eliminar"
      );
    }
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 z-30 w-[300px] bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-xl overflow-hidden animate-fade-in">
      <div className="px-4 py-2.5 border-b border-[var(--color-border-primary)]">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Stickers guardados
        </p>
      </div>

      <div className="max-h-64 overflow-y-auto p-2">
        {showLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando…
          </div>
        )}

        {!showLoading && isError && (
          <p className="px-2 py-6 text-sm text-center text-red-400">{errorMessage}</p>
        )}

        {!showLoading && !isError && stickers.length === 0 && (
          <p className="px-2 py-6 text-sm text-center text-[var(--color-text-muted)] leading-relaxed">
            Aún no tienes stickers.
            <br />
            Guarda uno desde el menú del mensaje.
          </p>
        )}

        {!showLoading && !isError && stickers.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {stickers.map((sticker) => (
              <div key={sticker.id} className="relative group/sticker">
                <button
                  type="button"
                  disabled={disabled || !sticker.fileUrl}
                  onClick={() => onSelect(sticker)}
                  className={cn(
                    "w-full aspect-square rounded-lg p-1.5 transition-colors",
                    "hover:bg-[var(--color-bg-hover)] disabled:opacity-40"
                  )}
                  title="Enviar sticker"
                >
                  {sticker.fileUrl ? (
                    <img
                      src={sticker.fileUrl}
                      alt={sticker.fileName}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-[10px] text-[var(--color-text-muted)]">Sin archivo</span>
                  )}
                </button>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={() => void handleDelete(sticker.id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/55 text-white opacity-0 group-hover/sticker:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
