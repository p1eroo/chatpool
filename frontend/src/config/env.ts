const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export const env = {
  apiUrl,
  /** Placeholder del path /api/v1/inboxes/:id en la documentación. */
  apiInboxId:
    import.meta.env.VITE_API_INBOX_ID ??
    import.meta.env.VITE_API_ACCOUNT_ID ??
    "INBOX_ID",
  useMock: import.meta.env.VITE_USE_MOCK !== "false",
  webhookBaseUrl:
    import.meta.env.VITE_WEBHOOK_BASE_URL ?? `${apiUrl.replace(/\/$/, "")}/webhooks`,
} as const;
