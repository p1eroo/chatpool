import { X } from "lucide-react";
import { LabelColorDot } from "@/components/settings/LabelColorDot";
import { getLabelChipStyle } from "@/lib/labelColorUtils";
import { cn } from "@/lib/utils";
import type { Label } from "@/types";

type LabelChipLabel = Pick<Label, "id" | "name" | "color">;

interface LabelChipProps {
  label: LabelChipLabel;
  /** Color resuelto del mapa único de la bandeja. */
  accentColor?: string;
  size?: "sm" | "md";
  className?: string;
  title?: string;
  onClick?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}

export function LabelChip({
  label,
  accentColor,
  size = "md",
  className,
  title,
  onClick,
  onDelete,
  deleting = false,
}: LabelChipProps) {
  const chip = getLabelChipStyle(
    label.color,
    label.id || label.name,
    accentColor
  );

  const content = (
    <>
      <LabelColorDot
        color={chip.accentColor}
        className={cn(size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2")}
      />
      <span className="truncate">{label.name}</span>
      {onDelete ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          title={`Eliminar ${label.name}`}
          className="ml-0.5 w-5 h-5 inline-flex items-center justify-center rounded-full text-current/80 hover:text-white hover:bg-black/25 transition-colors disabled:opacity-50"
        >
          <X className="w-3 h-3" />
        </button>
      ) : null}
    </>
  );

  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-full font-medium max-w-full",
    size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] pl-2.5 pr-1.5 py-1",
    onDelete && "pr-1",
    onClick && "hover:brightness-110 transition-[filter]",
    className
  );

  const style = {
    backgroundColor: chip.backgroundColor,
    color: chip.color,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={classes}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <span title={title ?? chip.accentColor} className={classes} style={style}>
      {content}
    </span>
  );
}
