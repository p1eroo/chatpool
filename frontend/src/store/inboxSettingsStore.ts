import { create } from "zustand";
import { env } from "@/config/env";
import { inboxSettings as seedInboxSettings } from "@/data/mock";
import type { InboxSettings, InboxStatus } from "@/types";

const STORAGE_KEY = "chatpool-inbox-settings";

function loadSettings(): InboxSettings[] {
  if (typeof window === "undefined") return seedInboxSettings;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as InboxSettings[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore invalid storage
  }

  return seedInboxSettings;
}

function saveSettings(settings: InboxSettings[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface InboxSettingsState {
  settings: InboxSettings[];
  setSettings: (settings: InboxSettings[]) => void;
  getByInboxId: (inboxId: string) => InboxSettings | undefined;
  addSettings: (settings: InboxSettings) => void;
  updateStatus: (inboxId: string, status: InboxStatus) => void;
  updateSettings: (inboxId: string, patch: Partial<Omit<InboxSettings, "inboxId">>) => void;
  getInboxIdsForAgent: (agentId: string) => string[];
  getInboxCountForAgent: (agentId: string) => number;
  setAgentInboxAccess: (agentId: string, inboxIds: string[]) => void;
  removeAgentFromAllInboxes: (agentId: string) => void;
}

export const useInboxSettingsStore = create<InboxSettingsState>((set, get) => ({
  settings: env.useMock ? loadSettings() : [],

  setSettings: (settings) => set({ settings }),

  getByInboxId: (inboxId) => get().settings.find((item) => item.inboxId === inboxId),

  addSettings: (settings) => {
    const next = [settings, ...get().settings];
    saveSettings(next);
    set({ settings: next });
  },

  updateStatus: (inboxId, status) => {
    const settings = get().settings.map((item) =>
      item.inboxId === inboxId ? { ...item, status } : item
    );
    saveSettings(settings);
    set({ settings });
  },

  updateSettings: (inboxId, patch) => {
    const settings = get().settings.map((item) =>
      item.inboxId === inboxId ? { ...item, ...patch } : item
    );
    saveSettings(settings);
    set({ settings });
  },

  getInboxIdsForAgent: (agentId) =>
    get()
      .settings.filter((item) => item.assignedAgentIds.includes(agentId))
      .map((item) => item.inboxId),

  getInboxCountForAgent: (agentId) =>
    get().settings.filter((item) => item.assignedAgentIds.includes(agentId)).length,

  setAgentInboxAccess: (agentId, inboxIds) => {
    const allowed = new Set(inboxIds);
    const settings = get().settings.map((item) => {
      const hasAccess = allowed.has(item.inboxId);
      const currentlyHas = item.assignedAgentIds.includes(agentId);

      if (hasAccess && !currentlyHas) {
        return { ...item, assignedAgentIds: [...item.assignedAgentIds, agentId] };
      }
      if (!hasAccess && currentlyHas) {
        return {
          ...item,
          assignedAgentIds: item.assignedAgentIds.filter((id) => id !== agentId),
        };
      }
      return item;
    });
    saveSettings(settings);
    set({ settings });
  },

  removeAgentFromAllInboxes: (agentId) => {
    const settings = get().settings.map((item) => ({
      ...item,
      assignedAgentIds: item.assignedAgentIds.filter((id) => id !== agentId),
    }));
    saveSettings(settings);
    set({ settings });
  },
}));
