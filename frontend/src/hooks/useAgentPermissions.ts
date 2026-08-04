import { useMemo } from "react";
import { getDefaultPermissions } from "@/lib/agentPermissions";
import { useCurrentAgent } from "@/hooks/useCurrentAgent";
import { SYSTEM_ROLE_IDS, useRoleStore } from "@/store/roleStore";
import type { AgentPermissions } from "@/types";

const EMPTY_PERMISSIONS = getDefaultPermissions("agent");

export function useAgentPermissions(): AgentPermissions {
  const agent = useCurrentAgent();
  const roles = useRoleStore((s) => s.roles);

  return useMemo(() => {
    if (agent?.permissions) return agent.permissions;

    if (!agent?.roleId) return EMPTY_PERMISSIONS;

    const role = roles.find((item) => item.id === agent.roleId);
    if (role?.permissions) return role.permissions;

    if (agent.roleId === SYSTEM_ROLE_IDS.admin) {
      return getDefaultPermissions("admin");
    }

    return EMPTY_PERMISSIONS;
  }, [agent?.permissions, agent?.roleId, roles]);
}

export function useHasPermission(permission: keyof AgentPermissions): boolean {
  return useAgentPermissions()[permission];
}

export function useCanAccessSettings(): boolean {
  const permissions = useAgentPermissions();
  return (
    permissions.manageInboxes ||
    permissions.manageAgents ||
    permissions.manageIntegrations
  );
}

export function getFirstSettingsPath(permissions: AgentPermissions): string | null {
  if (permissions.manageInboxes) return "/settings/inboxes";
  if (permissions.manageAgents) return "/settings/agents";
  if (permissions.manageIntegrations) return "/settings/integrations";
  return null;
}
