import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";

export function BrowserNotificationsBridge() {
  useBrowserNotifications();
  return null;
}
