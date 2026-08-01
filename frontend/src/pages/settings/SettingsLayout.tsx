import { NavLink, Outlet, Navigate } from "react-router-dom";
import { AppToast } from "@/components/ui/AppToast";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/settings/inboxes", label: "Bandejas", end: false },
  { to: "/settings/agents", label: "Agentes", end: true },
  { to: "/settings/roles", label: "Roles", end: true },
  { to: "/settings/integrations", label: "Integraciones", end: true },
] as const;

export function SettingsLayout() {
  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-y-auto">
      <div className="mx-auto max-w-6xl w-full p-6">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Configuración</h1>
        <p className="text-[13px] text-[var(--color-text-muted)] mb-4">
          Bandejas e integraciones por canal; agentes y roles a nivel de cuenta
        </p>

        <div className="flex gap-0.5 mb-4 bg-[var(--color-bg-secondary)] rounded-lg p-0.5 w-fit">
          {tabs.map((tab) => (
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

        <Outlet />
      </div>
      <AppToast />
    </div>
  );
}

export function SettingsIndexRedirect() {
  return <Navigate to="/settings/inboxes" replace />;
}
