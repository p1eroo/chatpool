import { create } from "zustand";
import type { Message } from "@/types";

interface UIState {
  contactSidebarOpen: boolean;
  isNoteMode: boolean;
  replyToMessage: Message | null;
  noteAboutMessage: Message | null;
  toast: string | null;
  lightboxMessageId: string | null;
  attachFileRequest: File | null;
  jumpToMessageId: string | null;
  forwardSourceConversationId: string | null;
  forwardSelectedMessageIds: string[];
  forwardSelectionMode: boolean;
  forwardModalOpen: boolean;
  toggleContactSidebar: () => void;
  setContactSidebarOpen: (open: boolean) => void;
  toggleNoteMode: () => void;
  setNoteMode: (note: boolean) => void;
  setReplyToMessage: (message: Message | null) => void;
  setNoteAboutMessage: (message: Message | null) => void;
  openLightbox: (messageId: string) => void;
  closeLightbox: () => void;
  requestAttachFile: (file: File) => void;
  clearAttachFileRequest: () => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  jumpToMessage: (messageId: string) => void;
  clearJumpToMessage: () => void;
  beginForwardSelection: (conversationId: string, initialMessageId?: string) => void;
  toggleForwardMessageSelection: (messageId: string) => void;
  openForwardModal: () => void;
  closeForwardModal: () => void;
  clearForwardFlow: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  contactSidebarOpen: true,
  isNoteMode: false,
  replyToMessage: null,
  noteAboutMessage: null,
  toast: null,
  lightboxMessageId: null,
  attachFileRequest: null,
  jumpToMessageId: null,
  forwardSourceConversationId: null,
  forwardSelectedMessageIds: [],
  forwardSelectionMode: false,
  forwardModalOpen: false,

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
    set(
      message
        ? { noteAboutMessage: message, isNoteMode: true }
        : { noteAboutMessage: null, isNoteMode: false }
    ),
  openLightbox: (messageId) => set({ lightboxMessageId: messageId }),
  closeLightbox: () => set({ lightboxMessageId: null }),
  requestAttachFile: (file) => set({ attachFileRequest: file }),
  clearAttachFileRequest: () => set({ attachFileRequest: null }),
  showToast: (message) => {
    set({ toast: message });
    setTimeout(() => set({ toast: null }), 2500);
  },
  clearToast: () => set({ toast: null }),
  jumpToMessage: (messageId) => set({ jumpToMessageId: messageId }),
  clearJumpToMessage: () => set({ jumpToMessageId: null }),
  beginForwardSelection: (conversationId, initialMessageId) =>
    set({
      forwardSourceConversationId: conversationId,
      forwardSelectedMessageIds: initialMessageId ? [initialMessageId] : [],
      forwardSelectionMode: true,
      forwardModalOpen: false,
    }),
  toggleForwardMessageSelection: (messageId) =>
    set((state) => {
      const selected = state.forwardSelectedMessageIds;
      const exists = selected.includes(messageId);
      return {
        forwardSelectedMessageIds: exists
          ? selected.filter((id) => id !== messageId)
          : [...selected, messageId],
      };
    }),
  openForwardModal: () =>
    set((state) =>
      state.forwardSelectedMessageIds.length > 0
        ? { forwardModalOpen: true }
        : state
    ),
  closeForwardModal: () => set({ forwardModalOpen: false }),
  clearForwardFlow: () =>
    set({
      forwardSourceConversationId: null,
      forwardSelectedMessageIds: [],
      forwardSelectionMode: false,
      forwardModalOpen: false,
    }),
}));
