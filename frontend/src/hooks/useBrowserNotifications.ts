import { useEffect } from "react";
import { syncBrowserUnreadTitle } from "@/lib/incomingMessageNotifications";
import { useConversationStore } from "@/store/conversationStore";

export function useBrowserNotifications(): void {
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
