import { useEffect, useState } from "react";
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
      .catch(() => {
        useAuthStore.getState().forceLogout("SESSION_EXPIRED");
      })
      .finally(() => setReady(true));
  }, [isAuthenticated]);

  if (!ready) {
    return <AppLoadingState message="Cargando datos…" fullScreen />;
  }

  return children;
}
