const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export const env = {
  apiUrl,
  /** Debe coincidir con API_ACCOUNT_ID del backend (path /api/v1/accounts/:id). */
  apiAccountId: import.meta.env.VITE_API_ACCOUNT_ID ?? "1",
  useMock: import.meta.env.VITE_USE_MOCK !== "false",
  webhookBaseUrl:
    import.meta.env.VITE_WEBHOOK_BASE_URL ?? `${apiUrl.replace(/\/$/, "")}/webhooks`,
} as const;
