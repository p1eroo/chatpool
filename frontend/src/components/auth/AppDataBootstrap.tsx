import { useEffect, useState } from "react";
import { isApiError } from "@/api/errors";
import { env } from "@/config/env";
import { bootstrapAppData } from "@/services/bootstrapService";
import { useAuthStore } from "@/store/authStore";
import { AppLoadingState } from "@/components/ui/AppLoadingState";

export function AppDataBootstrap({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [ready, setReady] = useState(env.useMock);

  useEffect(() => {
    if (env.useMock || !isAuthenticated) {
      setReady(true);
      return;
    }

    setReady(false);
    void bootstrapAppData()
      .catch((error) => {
        if (isApiError(error) && error.status === 401) {
          useAuthStore.getState().forceLogout("SESSION_EXPIRED");
        } else {
          console.error("[bootstrap] Error cargando datos de la app", error);
        }
      })
      .finally(() => setReady(true));
  }, [isAuthenticated]);

  if (!ready) {
    return <AppLoadingState message="Cargando datos…" fullScreen />;
  }

  return children;
}
