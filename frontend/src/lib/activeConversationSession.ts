const RELOAD_RESTORE_PREFIX = "chatpool:active-conversation-reload:";

function reloadStorageKey(agentId: string): string {
  return `${RELOAD_RESTORE_PREFIX}${agentId}`;
}

/** Guarda el chat activo justo antes de recargar la pestaña (F5). */
export function saveReloadActiveConversation(agentId: string, conversationId: string): void {
  if (!agentId || !conversationId) return;
  sessionStorage.setItem(reloadStorageKey(agentId), conversationId);
}

/** Lee y borra el chat guardado para restaurar tras F5. */
export function consumeReloadActiveConversation(agentId: string): string | null {
  if (!agentId) return null;
  const key = reloadStorageKey(agentId);
  const conversationId = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  return conversationId;
}

export function clearReloadActiveConversation(agentId: string): void {
  if (!agentId) return;
  sessionStorage.removeItem(reloadStorageKey(agentId));
}

/** True cuando la página cargó por recarga (F5), no por navegación normal. */
export function isPageReloadNavigation(): boolean {
  if (typeof performance === "undefined") return false;
  const entry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return entry?.type === "reload";
}
