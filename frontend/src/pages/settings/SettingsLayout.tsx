import { Outlet, Navigate } from "react-router-dom";
import { AppToast } from "@/components/ui/AppToast";
import {
  getFirstSettingsPath,
  useAgentPermissions,
} from "@/hooks/useAgentPermissions";

export function SettingsLayout() {
  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-y-auto">
      <div className="mx-auto max-w-6xl w-full p-6">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
          Configuración
        </h1>
        <p className="text-[13px] text-[var(--color-text-muted)] mb-6">
          Bandejas e integraciones por canal; agentes y roles a nivel de cuenta
        </p>
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
