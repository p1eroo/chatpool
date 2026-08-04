import { NavLink, Outlet, Navigate } from "react-router-dom";
import { AppToast } from "@/components/ui/AppToast";
import { cn } from "@/lib/utils";
import {
  getFirstSettingsPath,
  useAgentPermissions,
} from "@/hooks/useAgentPermissions";
import type { AgentPermissions } from "@/types";

const tabs: Array<{
  to: string;
  label: string;
  end: boolean;
  permission: keyof AgentPermissions;
}> = [
  { to: "/settings/inboxes", label: "Bandejas", end: false, permission: "manageInboxes" },
  { to: "/settings/agents", label: "Agentes", end: true, permission: "manageAgents" },
  { to: "/settings/roles", label: "Roles", end: true, permission: "manageAgents" },
  {
    to: "/settings/integrations",
    label: "Integraciones",
    end: true,
    permission: "manageIntegrations",
  },
];

export function SettingsLayout() {
  const permissions = useAgentPermissions();
  const visibleTabs = tabs.filter((tab) => permissions[tab.permission]);

  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-y-auto">
      <div className="mx-auto max-w-6xl w-full p-6">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Configuración</h1>
        <p className="text-[13px] text-[var(--color-text-muted)] mb-4">
          Bandejas e integraciones por canal; agentes y roles a nivel de cuenta
        </p>

        {visibleTabs.length > 0 ? (
          <div className="flex gap-0.5 mb-4 bg-[var(--color-bg-secondary)] rounded-lg p-0.5 w-fit">
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    "px-4 py-1.5 text-[13px] rounded-md transition-colors font-medium",
                    isActive
                      ? "bg-[var(--color-brand)] text-white"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        ) : null}

        <Outlet />
      </div>
      <AppToast />
    </div>
  );
}

export function SettingsIndexRedirect() {
  const permissions = useAgentPermissions();
  const path = getFirstSettingsPath(permissions);
  return <Navigate to={path ?? "/inbox"} replace />;
}
