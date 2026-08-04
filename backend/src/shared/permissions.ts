export type PermissionKey =
  | "manageInboxes"
  | "manageAgents"
  | "manageIntegrations"
  | "viewReports"
  | "assignConversations"
  | "resolveConversations"
  | "deleteConversations"
  | "sendMessages"
  | "manageLabels"
  | "manageCannedResponses";

export type AgentPermissions = Record<PermissionKey, boolean>;

export const PERMISSION_KEYS: PermissionKey[] = [
  "manageInboxes",
  "manageAgents",
  "manageIntegrations",
  "viewReports",
  "assignConversations",
  "resolveConversations",
  "deleteConversations",
  "sendMessages",
  "manageLabels",
  "manageCannedResponses",
];

const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  manageInboxes: false,
  manageAgents: false,
  manageIntegrations: false,
  viewReports: false,
  assignConversations: true,
  resolveConversations: true,
  deleteConversations: false,
  sendMessages: true,
  manageLabels: true,
  manageCannedResponses: true,
};

export function normalizePermissions(raw: unknown): AgentPermissions {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const permissions = { ...DEFAULT_AGENT_PERMISSIONS };
  for (const key of PERMISSION_KEYS) {
    if (typeof source[key] === "boolean") {
      permissions[key] = source[key];
    }
  }
  return permissions;
}
