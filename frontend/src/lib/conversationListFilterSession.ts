const STORAGE_PREFIX = "chatpool:conversation-list-filters:";

export type SavedConversationListFilters = {
  filterStatus: string;
  filterAssignee: "mine" | "unassigned" | "all";
};

function storageKey(agentId: string): string {
  return `${STORAGE_PREFIX}${agentId}`;
}

export function resolveConversationListFilters(
  agentId: string | undefined
): SavedConversationListFilters {
  const defaults: SavedConversationListFilters = {
    filterStatus: "open",
    filterAssignee: "mine",
  };

  if (!agentId || typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(storageKey(agentId));
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<SavedConversationListFilters>;
    return {
      filterStatus:
        parsed.filterStatus === "open" ||
        parsed.filterStatus === "resolved" ||
        parsed.filterStatus === "all"
          ? parsed.filterStatus
          : defaults.filterStatus,
      filterAssignee:
        parsed.filterAssignee === "mine" ||
        parsed.filterAssignee === "unassigned" ||
        parsed.filterAssignee === "all"
          ? parsed.filterAssignee
          : defaults.filterAssignee,
    };
  } catch {
    return defaults;
  }
}

export function saveConversationListFilters(
  agentId: string,
  filters: SavedConversationListFilters
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(agentId), JSON.stringify(filters));
}
