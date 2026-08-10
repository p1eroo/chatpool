import type { Message } from "@/types";
import { useConversationStore } from "@/store/conversationStore";
import { syncDocumentTitleUnreadCount } from "@/lib/documentTitle";
import { playMessageNotificationSound } from "@/lib/notificationSound";

const PROVISIONAL_INBOUND_PREFIX = "provisional-";
const SOUND_DEDUPE_MS = 5_000;
const recentSoundKeys = new Map<string, number>();

function isProvisionalInboundId(id: string): boolean {
  return id.startsWith(PROVISIONAL_INBOUND_PREFIX);
}

function claimNotificationSoundKey(key: string): boolean {
  const now = Date.now();
  for (const [existingKey, playedAt] of recentSoundKeys) {
    if (now - playedAt > SOUND_DEDUPE_MS) {
      recentSoundKeys.delete(existingKey);
    }
  }

  if (recentSoundKeys.has(key)) return false;
  recentSoundKeys.set(key, now);
  return true;
}

/** Reproduce tras el paint para que el mensaje ya esté visible. */
function playSoundAfterPaint(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      playMessageNotificationSound();
    });
  });
}

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
      // total = chats con no leídos; al ver uno activo restamos ese chat.
      return Math.max(0, total - 1);
    }
  }

  return total;
}

export function syncBrowserUnreadTitle(): void {
  syncDocumentTitleUnreadCount(getEffectiveUnreadCount());
}

/**
 * Must run before applyRealtimeMessage so provisional→persisted replacements
 * are still visible in the store.
 */
export function shouldPlayIncomingMessageSound(
  message: Message,
  conversationId: string,
  inboxId?: string | null
): boolean {
  if (message.senderType !== "contact") return false;

  const { activeConversationId, filterInboxId, messages, conversations } =
    useConversationStore.getState();

  const messageInboxId =
    inboxId ??
    conversations.find((conversation) => conversation.id === conversationId)?.inboxId;

  // Solo notificar mensajes de la bandeja que el agente está viendo.
  if (filterInboxId && messageInboxId && messageInboxId !== filterInboxId) {
    return false;
  }

  const isViewingConversation =
    activeConversationId === conversationId &&
    document.visibilityState === "visible";

  if (isViewingConversation) return false;

  const existing = messages[conversationId] ?? [];
  if (existing.some((item) => item.id === message.id)) return false;

  // Persistido que reemplaza provisional: el sonido ya se programó con el provisional.
  if (
    message.externalId &&
    !isProvisionalInboundId(message.id) &&
    existing.some(
      (item) =>
        item.externalId === message.externalId && isProvisionalInboundId(item.id)
    )
  ) {
    return false;
  }

  const dedupeKey = message.externalId ?? message.id;
  return claimNotificationSoundKey(dedupeKey);
}

export function notifyIncomingMessage(
  message: Message,
  conversationId: string,
  options?: { playSound?: boolean; inboxId?: string | null }
): void {
  syncBrowserUnreadTitle();

  const playSound =
    options?.playSound ??
    shouldPlayIncomingMessageSound(message, conversationId, options?.inboxId);

  if (playSound) {
    playSoundAfterPaint();
  }
}
