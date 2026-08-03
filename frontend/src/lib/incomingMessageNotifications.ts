import type { Message } from "@/types";
import { useConversationStore } from "@/store/conversationStore";
import { syncDocumentTitleUnreadCount } from "@/lib/documentTitle";
import { playMessageNotificationSound } from "@/lib/notificationSound";

export function getEffectiveUnreadCount(): number {
  const state = useConversationStore.getState();
  const total = state.getTotalUnread();

  if (
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    state.activeConversationId
  ) {
    const active = state.conversations.find(
      (conversation) => conversation.id === state.activeConversationId
    );
    if (active && active.unreadCount > 0) {
      return Math.max(0, total - active.unreadCount);
    }
  }

  return total;
}

export function syncBrowserUnreadTitle(): void {
  syncDocumentTitleUnreadCount(getEffectiveUnreadCount());
}

export function shouldPlayIncomingMessageSound(
  message: Message,
  conversationId: string
): boolean {
  if (message.senderType !== "contact") return false;

  const { activeConversationId } = useConversationStore.getState();
  const isViewingConversation =
    activeConversationId === conversationId &&
    document.visibilityState === "visible";

  return !isViewingConversation;
}

export function notifyIncomingMessage(
  message: Message,
  conversationId: string
): void {
  syncBrowserUnreadTitle();

  if (shouldPlayIncomingMessageSound(message, conversationId)) {
    playMessageNotificationSound();
  }
}
