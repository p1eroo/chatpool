import { useEffect, useState } from "react";

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Countdown mm:ss mientras botPausedUntil esté en el futuro; null si el bot está activo. */
export function useBotPauseCountdown(botPausedUntil: Date | null | undefined): string | null {
  const [label, setLabel] = useState<string | null>(() => {
    if (!botPausedUntil) return null;
    const remaining = botPausedUntil.getTime() - Date.now();
    return remaining > 0 ? formatCountdown(remaining) : null;
  });

  useEffect(() => {
    if (!botPausedUntil) {
      setLabel(null);
      return;
    }

    function tick() {
      const remaining = botPausedUntil!.getTime() - Date.now();
      if (remaining <= 0) {
        setLabel(null);
        return false;
      }
      setLabel(formatCountdown(remaining));
      return true;
    }

    if (!tick()) return;

    const id = window.setInterval(() => {
      if (!tick()) window.clearInterval(id);
    }, 1000);

    return () => window.clearInterval(id);
  }, [botPausedUntil]);

  return label;
}
