import { useCallback, useEffect, useRef, useState } from "react";
import { APP_BUILD_ID, fetchDeployedBuildId } from "@/config/appVersion";

const CHECK_INTERVAL_MS = 30_000;
const DISMISS_STORAGE_KEY = "chatpool-update-dismissed-build";

function readDismissedBuildId(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistDismissedBuildId(buildId: string) {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, buildId);
  } catch {
    // ignore quota / private mode
  }
}

export function useAppUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (import.meta.env.DEV || checkingRef.current) return;
    checkingRef.current = true;

    try {
      const remoteBuildId = await fetchDeployedBuildId();
      if (!remoteBuildId || remoteBuildId === APP_BUILD_ID) return;
      if (readDismissedBuildId() === remoteBuildId) return;

      setRemoteBuildId(remoteBuildId);
      setUpdateAvailable(true);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    void checkForUpdate();

    const interval = window.setInterval(() => {
      void checkForUpdate();
    }, CHECK_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [checkForUpdate]);

  const dismiss = useCallback(() => {
    if (remoteBuildId) {
      persistDismissedBuildId(remoteBuildId);
    }
    setUpdateAvailable(false);
  }, [remoteBuildId]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  return { updateAvailable, dismiss, reload };
}
