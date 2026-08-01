import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  avatar?: string;
  className?: string;
}

const sizeClasses = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-11 h-11 text-base",
  xl: "w-16 h-16 text-xl",
};

const avatarColors = [
  "bg-purple-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
];

export function getAvatarInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAvatarColorClass(name: string): string {
  const colorIndex =
    name.split("").reduce((acc, character) => acc + character.charCodeAt(0), 0) %
    avatarColors.length;
  return avatarColors[colorIndex];
}

export function isImageUrl(value?: string | null): boolean {
  if (!value) return false;
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith("/") ||
    value.startsWith("blob:") ||
    value.startsWith("data:image")
  );
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const initials = getAvatarInitials(name);
  const colorClass = getAvatarColorClass(name);

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white shrink-0",
        colorClass,
        sizeClasses[size],
        className
      )}
      title={name}
    >
      {initials}
    </div>
  );
}
