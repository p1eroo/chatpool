import { useCallback, useEffect, useRef, useState } from "react";
import {
  APP_BUILD_ID,
  APP_UPDATE_CHECK_EVENT,
  fetchDeployedBuildId,
  tryClaimAppUpdateCheck,
} from "@/config/appVersion";

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

  const checkForUpdate = useCallback(async (options?: { force?: boolean }) => {
    if (import.meta.env.DEV || checkingRef.current) return;
    if (!tryClaimAppUpdateCheck(options)) return;

    checkingRef.current = true;

    try {
      const remote = await fetchDeployedBuildId();
      if (!remote || remote === APP_BUILD_ID) return;
      if (readDismissedBuildId() === remote) return;

      setRemoteBuildId(remote);
      setUpdateAvailable(true);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    void checkForUpdate({ force: true });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    const onRequested = () => {
      // El throttle ya lo aplicó requestAppUpdateCheck antes de disparar el evento.
      void checkForUpdate({ force: true });
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(APP_UPDATE_CHECK_EVENT, onRequested);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(APP_UPDATE_CHECK_EVENT, onRequested);
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
