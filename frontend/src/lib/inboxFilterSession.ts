const STORAGE_PREFIX = "chatpool-inbox-filter";
const LEGACY_ALL_INBOXES = "__all__";

function storageKey(agentId: string): string {
  return `${STORAGE_PREFIX}-${agentId}`;
}

export function loadSavedInboxFilter(agentId: string): string | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = localStorage.getItem(storageKey(agentId));
    if (raw === null || raw === LEGACY_ALL_INBOXES) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

export function saveInboxFilter(agentId: string, inboxId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(agentId), inboxId);
}

export function resolveInboxFilter(
  agentId: string,
  availableInboxIds: string[]
): string | null {
  if (availableInboxIds.length === 0) return null;

  const saved = loadSavedInboxFilter(agentId);
  if (saved && availableInboxIds.includes(saved)) {
    return saved;
  }

  return availableInboxIds[0];
}
