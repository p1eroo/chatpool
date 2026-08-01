import { create } from "zustand";
import { env } from "@/config/env";
import { inboxes as seedInboxes } from "@/data/mock";
import type { Inbox, ChannelType } from "@/types";

const STORAGE_KEY = "chatpool-inboxes";

function loadInboxes(): Inbox[] {
  if (typeof window === "undefined") return seedInboxes;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Inbox[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore invalid storage
  }

  return seedInboxes;
}

function saveInboxes(inboxes: Inbox[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inboxes));
}

export interface CreateInboxInput {
  name: string;
  channelType: ChannelType;
}

interface InboxState {
  inboxes: Inbox[];
  activeInboxId: string | null;
  setInboxes: (inboxes: Inbox[]) => void;
  setActiveInbox: (id: string | null) => void;
  getInboxById: (id: string) => Inbox | undefined;
  addInbox: (input: CreateInboxInput) => string;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  inboxes: env.useMock ? loadInboxes() : [],
  activeInboxId: null,

  setInboxes: (inboxes) => set({ inboxes }),

  setActiveInbox: (id) => {
    set({ activeInboxId: id });
  },

  getInboxById: (id) => get().inboxes.find((inbox) => inbox.id === id),

  addInbox: (input) => {
    const id = `inbox-${Date.now()}`;
    const inbox: Inbox = {
      id,
      name: input.name.trim(),
      channelType: input.channelType,
      unreadCount: 0,
      icon: input.channelType,
    };

    const inboxes = [inbox, ...get().inboxes];
    saveInboxes(inboxes);
    set({ inboxes });
    return id;
  },
}));
