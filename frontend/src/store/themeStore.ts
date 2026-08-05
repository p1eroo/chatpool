import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_KEY = "chatpool-theme";
const LEGACY_THEME_KEY = "theme";

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;

  // Migrar clave legacy "theme" → "chatpool-theme"
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === "light" || legacy === "dark") {
    localStorage.setItem(THEME_KEY, legacy);
    localStorage.removeItem(LEGACY_THEME_KEY);
    return legacy;
  }

  return "dark";
}

function persistTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  localStorage.removeItem(LEGACY_THEME_KEY);
  applyThemeClass(theme);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),

  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark";
      persistTheme(next);
      return { theme: next };
    }),

  setTheme: (theme: Theme) => {
    persistTheme(theme);
    set({ theme });
  },
}));
