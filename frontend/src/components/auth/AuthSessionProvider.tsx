import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env } from "@/config/env";
import { getAccessToken } from "@/api/client";
import { registerAuthUnauthorizedHandler, useAuthStore } from "@/store/authStore";
import { AppLoadingState } from "@/components/ui/AppLoadingState";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const validateSession = useAuthStore((s) => s.validateSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [ready, setReady] = useState(env.useMock);

  useEffect(() => {
    registerAuthUnauthorizedHandler();
  }, []);

  useEffect(() => {
    if (env.useMock) return;

    const token = getAccessToken();
    if (!token && !isAuthenticated) {
      setReady(true);
      return;
    }

    void validateSession().then((valid) => {
      if (!valid && isAuthenticated) {
        navigate("/login", { replace: true });
      }
      setReady(true);
    });
  }, [validateSession, isAuthenticated, navigate]);

  if (!ready) {
    return <AppLoadingState message="Verificando sesión…" fullScreen />;
  }

  return children;
}
