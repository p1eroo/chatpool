const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export const env = {
  apiUrl,
  useMock: import.meta.env.VITE_USE_MOCK !== "false",
  webhookBaseUrl:
    import.meta.env.VITE_WEBHOOK_BASE_URL ?? `${apiUrl.replace(/\/$/, "")}/webhooks`,
} as const;
