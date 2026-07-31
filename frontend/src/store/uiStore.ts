import { create } from "zustand";
import type { Message } from "@/types";

interface UIState {
  contactSidebarOpen: boolean;
  isNoteMode: boolean;
  replyToMessage: Message | null;
  noteAboutMessage: Message | null;
  toast: string | null;
  toggleContactSidebar: () => void;
  setContactSidebarOpen: (open: boolean) => void;
  toggleNoteMode: () => void;
  setNoteMode: (note: boolean) => void;
  setReplyToMessage: (message: Message | null) => void;
  setNoteAboutMessage: (message: Message | null) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  contactSidebarOpen: true,
  isNoteMode: false,
  replyToMessage: null,
  noteAboutMessage: null,
  toast: null,

  toggleContactSidebar: () =>
    set((state) => ({ contactSidebarOpen: !state.contactSidebarOpen })),
  setContactSidebarOpen: (open) => set({ contactSidebarOpen: open }),
  toggleNoteMode: () =>
    set((state) => {
      const next = !state.isNoteMode;
      return {
        isNoteMode: next,
        noteAboutMessage: next ? state.noteAboutMessage : null,
      };
    }),
  setNoteMode: (note) =>
    set((state) => ({
      isNoteMode: note,
      noteAboutMessage: note ? state.noteAboutMessage : null,
    })),
  setReplyToMessage: (message) => set({ replyToMessage: message }),
  setNoteAboutMessage: (message) =>
    set(message ? { noteAboutMessage: message, isNoteMode: true } : { noteAboutMessage: null }),
  showToast: (message) => {
    set({ toast: message });
    setTimeout(() => set({ toast: null }), 2500);
  },
  clearToast: () => set({ toast: null }),
}));
