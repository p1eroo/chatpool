const STORAGE_PREFIX = "chatpool:active-conversation:";

function storageKey(agentId: string): string {
  return `${STORAGE_PREFIX}${agentId}`;
}

export function saveActiveConversation(agentId: string, conversationId: string | null): void {
  if (!agentId) return;

  if (conversationId) {
    sessionStorage.setItem(storageKey(agentId), conversationId);
    return;
  }

  sessionStorage.removeItem(storageKey(agentId));
}

export function loadActiveConversation(agentId: string): string | null {
  if (!agentId) return null;
  return sessionStorage.getItem(storageKey(agentId));
}
