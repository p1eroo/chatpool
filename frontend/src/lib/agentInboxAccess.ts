import type { Inbox, InboxSettings } from "@/types";

/** Bandejas a las que el agente tiene acceso explícito. */
export function getAccessibleInboxIds(
  agentId: string | null | undefined,
  settings: Pick<InboxSettings, "inboxId" | "assignedAgentIds">[]
): string[] {
  if (!agentId) return [];
  return settings
    .filter((item) => item.assignedAgentIds.includes(agentId))
    .map((item) => item.inboxId);
}

export function filterAccessibleInboxes(
  inboxes: Inbox[],
  agentId: string | null | undefined,
  settings: Pick<InboxSettings, "inboxId" | "assignedAgentIds">[]
): Inbox[] {
  const allowed = new Set(getAccessibleInboxIds(agentId, settings));
  return inboxes.filter((inbox) => allowed.has(inbox.id));
}
