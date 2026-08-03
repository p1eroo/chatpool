import { create } from "zustand";

const STORAGE_KEY = "chatpool-notification-settings";
const DEFAULT_VOLUME = 0.8;

interface NotificationSettingsState {
  volume: number;
  setVolume: (volume: number) => void;
}

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function loadSettings(): Pick<NotificationSettingsState, "volume"> {
  if (typeof window === "undefined") {
    return { volume: DEFAULT_VOLUME };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: DEFAULT_VOLUME };

    const parsed = JSON.parse(raw) as { muted?: boolean; volume?: number };
    if (typeof parsed.volume === "number") {
      return { volume: clampVolume(parsed.volume) };
    }

    if (parsed.muted) {
      return { volume: 0 };
    }
  } catch {
    // ignore invalid saved settings
  }

  return { volume: DEFAULT_VOLUME };
}

function persistSettings(volume: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume }));
}

export const useNotificationSettingsStore = create<NotificationSettingsState>((set) => ({
  ...loadSettings(),

  setVolume: (volume) => {
    const nextVolume = clampVolume(volume);
    persistSettings(nextVolume);
    set({ volume: nextVolume });
  },
}));
