import { cn } from "@/lib/utils";
import { isHexColor, normalizeHexColor } from "@/lib/labelColorUtils";

interface LabelColorDotProps {
  color: string;
  className?: string;
}

export function LabelColorDot({ color, className }: LabelColorDotProps) {
  const normalized = normalizeHexColor(color);

  if (isHexColor(color) || normalized.startsWith("#")) {
    return (
      <span
        className={cn("inline-block rounded-full shrink-0", className)}
        style={{ backgroundColor: normalized }}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-block rounded-full shrink-0",
        color === "purple" && "bg-purple-500",
        color === "blue" && "bg-blue-500",
        color === "green" && "bg-emerald-500",
        color === "yellow" && "bg-amber-500",
        color === "red" && "bg-red-500",
        color === "pink" && "bg-pink-500",
        color === "orange" && "bg-orange-500",
        !["purple", "blue", "green", "yellow", "red", "pink", "orange"].includes(color) &&
          "bg-gray-500",
        className
      )}
    />
  );
}
