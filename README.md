# Chatpool

Plataforma de mensajería multi-canal (estilo Chatwoot).

| Proyecto | Puerto | Descripción |
|----------|--------|-------------|
| `frontend/` | 5174 | React + Vite |
| `backend/` | **3001** | API + webhooks Meta |

## Inicio rápido

### Backend + PostgreSQL

Ver [backend/README.md](./backend/README.md) — crear BD, migrar, seed y `npm run dev`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Con API real: `VITE_USE_MOCK=false` y `VITE_API_URL=http://localhost:3001`.
