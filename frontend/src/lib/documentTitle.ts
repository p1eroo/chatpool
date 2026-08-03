export const APP_TITLE = "Chatpool";

export function syncDocumentTitleUnreadCount(unreadCount: number): void {
  document.title =
    unreadCount > 0 ? `(${unreadCount}) ${APP_TITLE}` : APP_TITLE;
}
