import { create } from "zustand";
import { env } from "@/config/env";
import { getMiniInboxes as seedMiniInboxes } from "@/data/mock";
import { normalizeHexColor } from "@/lib/labelColorUtils";
import { miniInboxApiService } from "@/services/miniInboxApiService";
import type { MiniInbox } from "@/types";

const STORAGE_KEY = "chatpool-mini-inboxes";

function loadMiniInboxes(): MiniInbox[] {
  if (typeof window === "undefined") return seedMiniInboxes();

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as MiniInbox[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore invalid storage
  }

  return seedMiniInboxes();
}

function persistMiniInboxes(miniInboxes: MiniInbox[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(miniInboxes));
}

interface MiniInboxState {
  miniInboxes: MiniInbox[];
  setMiniInboxes: (miniInboxes: MiniInbox[]) => void;
  getMiniInboxesForInbox: (inboxId: string) => MiniInbox[];
  getMiniInboxById: (miniInboxId: string) => MiniInbox | undefined;
  createMiniInbox: (
    inboxId: string,
    input: { name: string; color: string; matchPhrases: string[] }
  ) => Promise<boolean>;
  updateMiniInbox: (
    inboxId: string,
    miniInboxId: string,
    input: { name: string; color: string; matchPhrases: string[] }
  ) => Promise<boolean>;
  deleteMiniInbox: (inboxId: string, miniInboxId: string) => Promise<boolean>;
}

export const useMiniInboxStore = create<MiniInboxState>((set, get) => ({
  miniInboxes: loadMiniInboxes(),

  setMiniInboxes: (miniInboxes) => {
    if (env.useMock) persistMiniInboxes(miniInboxes);
    set({ miniInboxes });
  },

  getMiniInboxesForInbox: (inboxId) =>
    get().miniInboxes
      .filter((mini) => mini.inboxId === inboxId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),

  getMiniInboxById: (miniInboxId) =>
    get().miniInboxes.find((mini) => mini.id === miniInboxId),

  createMiniInbox: async (inboxId, input) => {
    const name = input.name.trim();
    if (!name) return false;

    const duplicate = get().miniInboxes.some(
      (mini) =>
        mini.inboxId === inboxId && mini.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) return false;

    try {
      if (env.useMock) {
        const mini: MiniInbox = {
          id: `mini-${Date.now()}`,
          inboxId,
          name,
          color: normalizeHexColor(input.color),
          sortOrder: get().miniInboxes.filter((m) => m.inboxId === inboxId).length,
          matchPhrases: input.matchPhrases,
        };
        const miniInboxes = [...get().miniInboxes, mini];
        persistMiniInboxes(miniInboxes);
        set({ miniInboxes });
        return true;
      }

      const created = await miniInboxApiService.create(inboxId, {
        name,
        color: normalizeHexColor(input.color),
        matchPhrases: input.matchPhrases,
      });
      set({ miniInboxes: [...get().miniInboxes, created] });
      return true;
    } catch {
      return false;
    }
  },

  updateMiniInbox: async (inboxId, miniInboxId, input) => {
    const existing = get().miniInboxes.find(
      (mini) => mini.id === miniInboxId && mini.inboxId === inboxId
    );
    if (!existing) return false;

    const name = input.name.trim();
    if (!name) return false;

    const duplicate = get().miniInboxes.some(
      (mini) =>
        mini.inboxId === inboxId &&
        mini.name.toLowerCase() === name.toLowerCase() &&
        mini.id !== miniInboxId
    );
    if (duplicate) return false;

    const nextColor = normalizeHexColor(input.color);

    try {
      if (env.useMock) {
        const miniInboxes = get().miniInboxes.map((mini) =>
          mini.id === miniInboxId
            ? { ...mini, name, color: nextColor, matchPhrases: input.matchPhrases }
            : mini
        );
        persistMiniInboxes(miniInboxes);
        set({ miniInboxes });
        return true;
      }

      const updated = await miniInboxApiService.update(inboxId, miniInboxId, {
        name,
        color: nextColor,
        matchPhrases: input.matchPhrases,
      });
      set({
        miniInboxes: get().miniInboxes.map((mini) =>
          mini.id === miniInboxId ? updated : mini
        ),
      });
      return true;
    } catch {
      return false;
    }
  },

  deleteMiniInbox: async (inboxId, miniInboxId) => {
    const existing = get().miniInboxes.find(
      (mini) => mini.id === miniInboxId && mini.inboxId === inboxId
    );
    if (!existing) return false;

    try {
      if (env.useMock) {
        const miniInboxes = get().miniInboxes.filter((mini) => mini.id !== miniInboxId);
        persistMiniInboxes(miniInboxes);
        set({ miniInboxes });
        return true;
      }

      await miniInboxApiService.delete(inboxId, miniInboxId);
      set({
        miniInboxes: get().miniInboxes.filter((mini) => mini.id !== miniInboxId),
      });
      return true;
    } catch {
      return false;
    }
  },
}));

export const miniInboxService = {
  getMiniInboxesForInbox(inboxId: string): MiniInbox[] {
    return useMiniInboxStore.getState().getMiniInboxesForInbox(inboxId);
  },
};
