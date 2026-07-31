import { create } from "zustand";
import { inboxes } from "@/data/mock";
import type { Inbox } from "@/types";

interface InboxState {
  inboxes: Inbox[];
  activeInboxId: string | null;
  setActiveInbox: (id: string | null) => void;
  getInboxById: (id: string) => Inbox | undefined;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  inboxes,
  activeInboxId: null,

  setActiveInbox: (id) => {
    set({ activeInboxId: id });
  },

  getInboxById: (id) => get().inboxes.find((i) => i.id === id),
}));
