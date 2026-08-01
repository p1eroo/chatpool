/**
 * Rutas HTTP del backend Chatpool (referencia para integración).
 * Base: VITE_API_URL (default http://localhost:3001)
 */
export const apiRoutes = {
  auth: {
    login: "POST /auth/login",
    me: "GET /auth/me",
    logout: "POST /auth/logout",
  },
  integrations: {
    metaVerify: "POST /integrations/meta/verify",
    registerWebhook: "POST /integrations/webhooks/register",
    listAccounts: "GET /integrations/accounts",
  },
  contacts: {
    list: "GET /contacts",
  },
  webhooks: {
    /** Meta envía GET (verify) y POST (events) aquí */
    metaGlobal: "GET|POST /webhooks/meta",
    metaInbox: "GET|POST /webhooks/meta/:inboxId",
  },
} as const;
