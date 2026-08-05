import { useCallback, useEffect, useRef, useState } from "react";
import {
  APP_BUILD_ID,
  APP_UPDATE_CHECK_EVENT,
  fetchDeployedBuildId,
  tryClaimAppUpdateCheck,
} from "@/config/appVersion";

const DISMISS_STORAGE_KEY = "chatpool-update-dismissed-build";
export const APP_UPDATE_AUTO_RELOAD_SECONDS = 5;

function readDismissedBuildId(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function isMockUpdatePreview(): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).has("mockUpdate");
}

export function useAppUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isMockPreview] = useState(isMockUpdatePreview);
  const checkingRef = useRef(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const reload = useCallback(() => {
    clearCountdown();
    window.location.reload();
  }, [clearCountdown]);

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
    if (isMockPreview) {
      setRemoteBuildId("mock-preview");
      setUpdateAvailable(true);
      return;
    }

    if (import.meta.env.DEV) return;

    void checkForUpdate({ force: true });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    const onRequested = () => {
      void checkForUpdate({ force: true });
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(APP_UPDATE_CHECK_EVENT, onRequested);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(APP_UPDATE_CHECK_EVENT, onRequested);
    };
  }, [checkForUpdate, isMockPreview]);

  useEffect(() => {
    if (!updateAvailable) {
      setSecondsRemaining(null);
      clearCountdown();
      return;
    }

    let remaining = APP_UPDATE_AUTO_RELOAD_SECONDS;
    setSecondsRemaining(remaining);

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearCountdown();
        window.location.reload();
      }
    }, 1000);

    return clearCountdown;
  }, [updateAvailable, clearCountdown]);

  return { updateAvailable, reload, secondsRemaining, isMockPreview };
}
