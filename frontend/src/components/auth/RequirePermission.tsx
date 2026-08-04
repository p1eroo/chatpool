import { Navigate, Outlet } from "react-router-dom";
import {
  useAgentPermissions,
  useCanAccessSettings,
} from "@/hooks/useAgentPermissions";
import type { AgentPermissions } from "@/types";

interface RequirePermissionProps {
  anyOf: Array<keyof AgentPermissions>;
  fallback?: string;
}

export function RequirePermission({ anyOf, fallback = "/inbox" }: RequirePermissionProps) {
  const permissions = useAgentPermissions();
  const allowed = anyOf.some((key) => permissions[key]);

  if (!allowed) {
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}

export function RequireSettingsAccess() {
  const canAccess = useCanAccessSettings();

  if (!canAccess) {
    return <Navigate to="/inbox" replace />;
  }

  return <Outlet />;
}
