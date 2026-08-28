import type { Message } from "@/types";
import { useConversationStore } from "@/store/conversationStore";
import { syncDocumentTitleUnreadCount } from "@/lib/documentTitle";

export function getEffectiveUnreadCount(): number {
  const state = useConversationStore.getState();
  const total = state.getTotalUnread();

  if (
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    state.isInboxViewActive &&
    state.activeConversationId
  ) {
    const active = state.conversations.find(
      (conversation) => conversation.id === state.activeConversationId
    );
    if (active && active.unreadCount > 0) {
      // total = chats con no leídos; al ver uno activo restamos ese chat.
      return Math.max(0, total - 1);
    }
  }

  return total;
}

export function syncBrowserUnreadTitle(): void {
  syncDocumentTitleUnreadCount(getEffectiveUnreadCount());
}

export function notifyIncomingMessage(
  _message: Message,
  _conversationId: string,
  _options?: { inboxId?: string | null }
): void {
  syncBrowserUnreadTitle();
}
