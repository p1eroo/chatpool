const STORAGE_PREFIX = "chatpool:active-conversation:";
const LEGACY_RELOAD_PREFIX = "chatpool:active-conversation-reload:";

function storageKey(agentId: string): string {
  return `${STORAGE_PREFIX}${agentId}`;
}

function legacyReloadKey(agentId: string): string {
  return `${LEGACY_RELOAD_PREFIX}${agentId}`;
}

function readSessionItem(key: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionItem(key: string, value: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (value) {
      sessionStorage.setItem(key, value);
      return;
    }
    sessionStorage.removeItem(key);
  } catch {
    // private mode / quota
  }
}

/** Persiste el chat seleccionado para restaurarlo tras F5 o al volver al inbox. */
export function saveActiveConversation(agentId: string, conversationId: string | null): void {
  if (!agentId) return;
  writeSessionItem(storageKey(agentId), conversationId);
  writeSessionItem(legacyReloadKey(agentId), null);
}

/** Lee el chat persistido. No lo borra: el inbox puede montarse más de una vez. */
export function loadActiveConversation(agentId: string): string | null {
  if (!agentId) return null;
  return readSessionItem(storageKey(agentId)) ?? readSessionItem(legacyReloadKey(agentId));
}

export function clearActiveConversation(agentId: string): void {
  saveActiveConversation(agentId, null);
}
