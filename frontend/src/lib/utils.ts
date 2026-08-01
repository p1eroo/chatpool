import { clsx, type ClassValue } from "clsx";
import {
  APP_LOCALE,
  APP_TIMEZONE,
  dateTimeFormatOptions,
  getDateKeyInAppTimezone,
} from "@/lib/locale";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(APP_LOCALE, {
    ...dateTimeFormatOptions,
    day: "numeric",
    month: "short",
  });
}

export function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString(APP_LOCALE, {
    ...dateTimeFormatOptions,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDate(date: Date): string {
  const todayKey = getDateKeyInAppTimezone(new Date());
  const yesterday = new Date(Date.now() - 86400000);
  const yesterdayKey = getDateKeyInAppTimezone(yesterday);
  const dateKey = getDateKeyInAppTimezone(date);

  if (dateKey === todayKey) return "Hoy";
  if (dateKey === yesterdayKey) return "Ayer";
  return date.toLocaleDateString(APP_LOCALE, {
    ...dateTimeFormatOptions,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function cnColor(color: string): string {
  const colors: Record<string, string> = {
    purple: "bg-purple-500",
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
    pink: "bg-pink-500",
    orange: "bg-orange-500",
  };
  return colors[color] || "bg-gray-500";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
