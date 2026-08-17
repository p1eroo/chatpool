# Chatpool API

Backend en **Node.js + TypeScript + Fastify + Prisma + PostgreSQL**, puerto **3001**.

## Arquitectura

```
src/
  config/           # Variables de entorno validadas (Zod)
  domain/           # Errores de dominio
  application/      # Casos de uso (auth, integraciones, webhooks)
  infrastructure/   # Prisma, Meta API, seguridad
  presentation/     # Rutas HTTP Fastify
  shared/
prisma/
  schema.prisma     # Esquema de BD
  seed.ts           # Datos iniciales
```

## 1. Crear la base de datos (tu servidor PostgreSQL)

Conéctate al servidor como superusuario y ejecuta:

```bash
psql -U postgres -h TU_HOST -f scripts/setup-db.sql
```

O manualmente:

```sql
CREATE USER chatpool WITH PASSWORD 'tu_password_seguro';
CREATE DATABASE chatpool OWNER chatpool ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE chatpool TO chatpool;
```

Si PostgreSQL está en **otro host**, la `DATABASE_URL` será:

```
postgresql://chatpool:tu_password@192.168.x.x:5432/chatpool?schema=public
```

## 2. Configurar entorno

```bash
cd backend
cp .env.example .env
# Edita .env: DATABASE_URL, JWT_SECRET, CORS_ORIGIN
npm install
```

## 3. Migraciones y seed

```bash
npm run db:generate
npm run db:migrate    # crea tablas
npm run db:seed       # roles, agentes demo, integraciones
```

**Superadmin:** `soporte` (contraseña definida en seed)

## 4. Arrancar API

```bash
npm run dev
# → http://localhost:3001
# GET /health
```

## 5. Conectar el frontend

En `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
VITE_USE_MOCK=false
VITE_WEBHOOK_BASE_URL=http://localhost:3001/webhooks
```

Para **Meta webhooks en local**, expón el puerto 3001 con ngrok/cloudflared y actualiza:

```env
WEBHOOK_BASE_URL=https://xxxx.ngrok-free.app/webhooks
PUBLIC_BASE_URL=https://xxxx.ngrok-free.app
```

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/login` | Login JWT |
| GET | `/auth/me` | Agente actual |
| GET | `/integrations/accounts` | Cuentas de integración |
| POST | `/integrations/meta/verify` | Validar número Meta + guardar credenciales |
| POST | `/integrations/webhooks/register` | Registrar webhook por bandeja |
| GET/POST | `/webhooks/meta` | Webhook global Meta |
| GET/POST | `/webhooks/meta/:inboxId` | Webhook por bandeja |

## Application API (n8n / Chatwoot-style)

API de integración **sin autenticación** (pensada para n8n en red confiable).

Base: `/api/v1/inboxes/{INBOX_ID}` — el `inboxId` del path es el `id` de la bandeja
(Call center, Facturación, etc.). Todo queda acotado a esa bandeja.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` (base) | Detalle de la bandeja |
| GET | `/conversations` | Listar conversaciones (`?phone=` opcional) |
| GET | `/conversations/:id` | Detalle (solo si pertenece a la bandeja) |
| POST | `/conversations` | Iniciar outbound WhatsApp (`phone`; bandeja = path) |
| POST | `/messages/send-template` | **Enviar plantilla por teléfono** (1 POST: conversación + envío) |
| GET | `/conversations/:id/messages` | Listar mensajes |
| GET | `/whatsapp-templates` | Plantillas WhatsApp aprobadas (Meta) de la bandeja |
| POST | `/conversations/:id/messages` | Enviar mensaje (o template WhatsApp) |
| POST | `/conversations/:id/request-contact-info` | Pedir número (botón oficial Meta, ventana 24 h) |
| GET/POST | `/conversations/:id/labels` | Ver / reemplazar etiquetas por nombre |
| POST | `/conversations/:id/toggle_status` | `open` \| `resolved` |
| POST | `/conversations/:id/assignments` | Asignar agente (`assignee_id`) |
| GET | `/contacts` | Contactos de la bandeja (`name`, `phone`, `conversationId`; `?phone=` opcional) |
| GET | `/labels`, `/agents`, `/profile` | Catálogos (scoped a la bandeja) |

Ejemplo n8n (HTTP Request) — enviar mensaje:

```bash
curl -X POST "http://localhost:3001/api/v1/inboxes/INBOX_ID/conversations/CONVERSATION_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hola desde n8n","private":false}'
```

Etiquetas (sobrescribe la lista, como Chatwoot):

```bash
curl -X POST "http://localhost:3001/api/v1/inboxes/INBOX_ID/conversations/CONVERSATION_ID/labels" \
  -H "Content-Type: application/json" \
  -d '{"labels":["soporte","vip"]}'
```

## Meta Cloud API

1. Crea bandeja WhatsApp en el frontend
2. En detalle de bandeja → **Verificar y conectar con Meta**
3. En Meta Developer Console → Webhook URL: `{WEBHOOK_BASE_URL}/meta/{inboxId}`
4. Verify token:
   - Webhook por bandeja (`/webhooks/meta/{inboxId}`): el de **Configuración → Bandejas → Integración**
   - Webhook global (`/webhooks/meta`): el de **Configuración → Integraciones** (`META_WEBHOOK_VERIFY_TOKEN`, por defecto `chatpool_meta_verify`)

## Tablas creadas

`roles`, `agents`, `inboxes`, `inbox_settings`, `inbox_agents`, `integration_accounts`, `contacts`, `conversations`, `messages`, `labels`, `conversation_labels`, `canned_responses`
