import EmojiPicker, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";
import es from "emoji-picker-react/dist/data/emojis-es";
import { useThemeStore } from "@/store/themeStore";
import { cn } from "@/lib/utils";

interface ComposerEmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  align?: "left" | "right";
}

export function ComposerEmojiPicker({
  onEmojiSelect,
  align = "right",
}: ComposerEmojiPickerProps) {
  const theme = useThemeStore((s) => s.theme);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
  };

  return (
    <div
      className={cn(
        "absolute bottom-full mb-2 z-30 rounded-xl overflow-hidden shadow-2xl border border-[var(--color-border-primary)] animate-fade-in",
        align === "left" ? "left-0" : "right-0"
      )}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
        emojiStyle={EmojiStyle.APPLE}
        emojiData={es}
        lazyLoadEmojis
        width={360}
        height={420}
        searchPlaceholder="Buscar"
        searchClearButtonLabel="Limpiar"
        previewConfig={{
          defaultCaption: "¿Cuál es tu estado de ánimo?",
          showPreview: true,
        }}
      />
    </div>
  );
}
