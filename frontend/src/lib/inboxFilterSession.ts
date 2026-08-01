const STORAGE_PREFIX = "chatpool-inbox-filter";
const ALL_INBOXES = "__all__";

function storageKey(agentId: string): string {
  return `${STORAGE_PREFIX}-${agentId}`;
}

/** `undefined` = sin preferencia guardada; `null` = "Todas las bandejas". */
export function loadSavedInboxFilter(agentId: string): string | null | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = localStorage.getItem(storageKey(agentId));
    if (raw === null) return undefined;
    if (raw === ALL_INBOXES) return null;
    return raw;
  } catch {
    return undefined;
  }
}

export function saveInboxFilter(agentId: string, inboxId: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(agentId), inboxId ?? ALL_INBOXES);
}

export function resolveInboxFilter(
  agentId: string,
  availableInboxIds: string[]
): string | null {
  if (availableInboxIds.length === 0) return null;

  const saved = loadSavedInboxFilter(agentId);

  if (saved === undefined) {
    return availableInboxIds[0];
  }

  if (saved === null) {
    return null;
  }

  return availableInboxIds.includes(saved) ? saved : availableInboxIds[0];
}
