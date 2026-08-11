import { create } from "zustand";
import { env } from "@/config/env";
import { labels as seedLabels } from "@/data/mock";
import { normalizeHexColor } from "@/lib/labelColorUtils";
import { labelApiService } from "@/services/labelApiService";
import type { Label } from "@/types";

const STORAGE_KEY = "chatpool-labels";

function loadLabels(): Label[] {
  if (typeof window === "undefined") return seedLabels;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Label[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore invalid storage
  }

  return seedLabels;
}

function persistLabels(labels: Label[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
}

interface LabelState {
  labels: Label[];
  setLabels: (labels: Label[]) => void;
  getLabelsForInbox: (inboxId: string) => Label[];
  getLabelById: (labelId: string) => Label | undefined;
  createLabel: (inboxId: string, name: string, color: string) => Promise<boolean>;
  deleteLabel: (inboxId: string, labelId: string) => Promise<boolean>;
}

export const useLabelStore = create<LabelState>((set, get) => ({
  labels: loadLabels(),

  setLabels: (labels) => {
    if (env.useMock) persistLabels(labels);
    set({ labels });
  },

  getLabelsForInbox: (inboxId) =>
    get().labels.filter((label) => label.inboxId === inboxId),

  getLabelById: (labelId) => get().labels.find((label) => label.id === labelId),

  createLabel: async (inboxId, name, color) => {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) return false;

    const duplicate = get().labels.some(
      (label) => label.inboxId === inboxId && label.name === normalizedName
    );
    if (duplicate) return false;

    try {
      if (env.useMock) {
        const label: Label = {
          id: `label-${Date.now()}`,
          name: normalizedName,
          color: normalizeHexColor(color),
          inboxId,
        };
        const labels = [...get().labels, label];
        persistLabels(labels);
        set({ labels });
        return true;
      }

      const label = await labelApiService.create(inboxId, {
        name: normalizedName,
        color: normalizeHexColor(color),
      });
      set({ labels: [...get().labels, label] });
      return true;
    } catch {
      return false;
    }
  },

  deleteLabel: async (inboxId, labelId) => {
    const existing = get().labels.find(
      (label) => label.id === labelId && label.inboxId === inboxId
    );
    if (!existing) return false;

    try {
      if (env.useMock) {
        const labels = get().labels.filter((label) => label.id !== labelId);
        persistLabels(labels);
        set({ labels });
        return true;
      }

      await labelApiService.delete(inboxId, labelId);
      set({ labels: get().labels.filter((label) => label.id !== labelId) });
      return true;
    } catch {
      return false;
    }
  },
}));

export const labelService = {
  getLabelsForInbox(inboxId: string): Label[] {
    return useLabelStore.getState().getLabelsForInbox(inboxId);
  },
};
