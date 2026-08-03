import { useEffect } from "react";
import { syncBrowserUnreadTitle } from "@/lib/incomingMessageNotifications";
import { unlockNotificationSound } from "@/lib/notificationSound";
import { useConversationStore } from "@/store/conversationStore";

export function useBrowserNotifications(): void {
  useEffect(() => {
    const unlock = () => unlockNotificationSound();

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    syncBrowserUnreadTitle();

    return useConversationStore.subscribe(() => {
      syncBrowserUnreadTitle();
    });
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => syncBrowserUnreadTitle();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);
}
