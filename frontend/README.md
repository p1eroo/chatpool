# Chatpool Frontend

UI de mensajería multi-canal (estilo Chatwoot) con mock local o backend real.

## Desarrollo

```bash
cp .env.example .env
npm install
npm run dev
```

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | URL del backend |
| `VITE_USE_MOCK` | `true` | `true` = Zustand + localStorage; `false` = HTTP |
| `VITE_WEBHOOK_BASE_URL` | `{VITE_API_URL}/webhooks` | URLs públicas para Meta webhooks |

## Arquitectura

```
src/
  api/           # Cliente HTTP, rutas de referencia, errores
  config/        # env.ts
  services/      # Lógica de negocio (mock | HTTP según VITE_USE_MOCK)
  store/         # Estado UI + persistencia mock
  hooks/         # React Query + helpers (useIntegrations, useCurrentAgent)
  types/         # Dominio + types/api.ts (DTOs del backend)
  lib/           # webhooks.ts, metaApi.ts, validaciones
```

### Webhooks (Meta)

- Global: `{WEBHOOK_BASE}/meta` — callback en Meta Business Suite
- Por bandeja: `{WEBHOOK_BASE}/meta/{inboxId}` — enrutado por número/bandeja

Ver `src/api/routes.ts` para contrato HTTP previsto del backend.

### Integración Meta

1. Crear bandeja WhatsApp en Ajustes → Bandejas
2. En detalle de bandeja → **Verificar y conectar con Meta** (Phone Number ID, WABA ID, token)
3. Copiar webhook en Integraciones y registrarlo en Meta

Con `VITE_USE_MOCK=true` la verificación simula éxito y activa la bandeja.
