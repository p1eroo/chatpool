import { create } from "zustand";
import { cannedResponses as seedCannedResponses } from "@/data/mock";
import type { CannedResponse } from "@/types";

const STORAGE_KEY = "chatpool-canned-responses";

function loadResponses(): CannedResponse[] {
  if (typeof window === "undefined") return seedCannedResponses;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as CannedResponse[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore invalid storage
  }

  return seedCannedResponses;
}

function saveResponses(responses: CannedResponse[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(responses));
}

interface CannedResponseState {
  responses: CannedResponse[];
  addResponse: (title: string, content: string) => void;
  updateResponse: (id: string, title: string, content: string) => void;
  deleteResponse: (id: string) => void;
}

export const useCannedResponseStore = create<CannedResponseState>((set, get) => ({
  responses: loadResponses(),

  addResponse: (title, content) => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) return;

    const responses = [
      {
        id: `cr-${Date.now()}`,
        title: trimmedTitle,
        content: trimmedContent,
      },
      ...get().responses,
    ];

    saveResponses(responses);
    set({ responses });
  },

  updateResponse: (id, title, content) => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) return;

    const responses = get().responses.map((response) =>
      response.id === id
        ? { ...response, title: trimmedTitle, content: trimmedContent }
        : response
    );

    saveResponses(responses);
    set({ responses });
  },

  deleteResponse: (id) => {
    const responses = get().responses.filter((response) => response.id !== id);
    saveResponses(responses);
    set({ responses });
  },
}));
