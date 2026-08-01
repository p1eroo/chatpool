import { useEffect, useState } from "react";
import { env } from "@/config/env";
import { bootstrapAppData } from "@/services/bootstrapService";
import { useAuthStore } from "@/store/authStore";

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <p className="text-sm text-[var(--color-text-muted)]">Cargando datos…</p>
      </div>
    );
  }

  return children;
}
