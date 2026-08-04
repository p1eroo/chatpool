import { useCallback, useEffect, useRef, useState } from "react";
import { APP_BUILD_ID, fetchDeployedVersion } from "@/config/appVersion";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 45_000;
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
      const remote = await fetchDeployedVersion();
      if (!remote?.buildId || remote.buildId === APP_BUILD_ID) return;
      if (readDismissedBuildId() === remote.buildId) return;

      setRemoteBuildId(remote.buildId);
      setUpdateAvailable(true);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    const initialTimer = window.setTimeout(() => {
      void checkForUpdate();
    }, INITIAL_DELAY_MS);

    const interval = window.setInterval(() => {
      void checkForUpdate();
    }, CHECK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
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
