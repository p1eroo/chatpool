# Integración Chatpool — Application API (Facturación / débitos)

Documento para el equipo del **otro sistema** que hoy envía plantillas WhatsApp directo a Meta.

---

## Objetivo

Enviar plantillas WhatsApp **a través de Chatpool** para que:

1. El conductor reciba el mensaje por WhatsApp (Meta).
2. El mensaje quede registrado en la bandeja **Facturación** del inbox de Chatpool.
3. El otro sistema **deje de llamar a Meta** (evita duplicados).

---

## Configuración (una sola vez)

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| **Base URL (prod)** | Ver abajo | URL del **backend** Chatpool (no el frontend `chat.taximonterrico.com`) |
| **INBOX_ID Facturación** | `cmsf044z400067do6kds0kdph` | Bandeja WhatsApp Facturación (confirmado en logs prod) |
| **Prefijo Application API** | `/api/v1/inboxes/{INBOX_ID}` | Envíos sin JWT |
| **Autenticación (envíos y plantillas)** | Ninguna | Restringir por firewall/nginx (solo IP del otro sistema) |
| **Content-Type** | `application/json` | En todos los POST |

### Confirmar la URL del backend

Antes de integrar, verifica que apuntas al **Chatpool API** (Fastify), no a otro CRM:

```bash
curl -s "https://TU-BACKEND/health"
# Esperado: {"status":"ok","service":"chatpool-api"}

curl -s "https://TU-BACKEND/"
# Esperado: {"status":"ok","service":"Chatpool API"}
```

Si ves `"Cannot GET /health"` o un 404 con formato distinto, ese dominio **no es Chatpool**. Revisa nginx o la URL que usa el frontend en DevTools (peticiones a `/auth/me`, `/conversations`, etc.).

**URL base Application API (ajustar dominio si hace falta):**

```
https://api-crm.taximonterrico.com/api/v1/inboxes/cmsf044z400067do6kds0kdph
```

---

## Resumen: qué hace el otro sistema

**Recomendado: 1 POST por conductor** (teléfono + plantilla en la misma llamada).

| Paso | Endpoint | Para qué |
|------|----------|----------|
| Setup | `GET .../whatsapp-templates` | Ver plantillas disponibles (una vez) |
| Envío | `POST .../messages/send-template` | Abrir chat + enviar plantilla WhatsApp |

```
Sistema Facturación
    │
    ├─ GET .../whatsapp-templates          ← catálogo (sin JWT)
    │
    └─ POST .../messages/send-template     ← 1 POST por conductor
           { phone, name, template_params }
```

**Alternativa (2 POST):** `POST /conversations` + `POST /conversations/{id}/messages` — sigue disponible si ya lo integraron o necesitan el `conversationId` antes de enviar.

---

## Plantillas: una API, dos formas de organizarlas en su sistema

Chatpool **siempre** recibe el nombre e idioma en cada envío:

```json
"template_params": {
  "name": "debito_registrado",
  "language": "es_PE",
  "processed_params": { "body": { "0": "150.00", "1": "Comisión semanal" } }
}
```

**No eligen entre APIs distintas.** Eligen **dónde guardan** ese `name` / `language` en su propio código:

### Forma 1 — Directo en el código

Cada envío incluye el nombre de plantilla explícito. Válido si solo usan 1–2 plantillas.

### Forma 2 — Config / `.env` en su backend (recomendado)

Un mapa caso → plantilla. El loop de negocio dice `"debito_registrado"` y un adapter lee la config y arma el JSON de Chatpool:

```yaml
chatpool:
  inbox_id: cmsf044z400067do6kds0kdph
  templates:
    debito_registrado:
      name: debito_registrado
      language: es_PE
    pago_aprobado:
      name: pago_aprobado
      language: es_PE
```

**Recomendación:** usar la Forma 2 y poblar ese config consultando las plantillas (sección siguiente).

> **Nota:** Chatpool no elige la plantilla por “caso de negocio” (ej. descuento vs débito). Eso lo define el otro sistema en su config; Chatpool solo envía el `name` / `language` que recibe.

---

## Consultar plantillas disponibles

Para integrar bien, el otro sistema debe saber: **nombre**, **idioma**, **cuántas variables** lleva y **texto con placeholders** (`{{1}}`, `{{2}}`, …).

### Application API — sin JWT (recomendado)

```http
GET /api/v1/inboxes/cmsf044z400067do6kds0kdph/whatsapp-templates
```

**Ejemplo curl:**

```bash
BASE="https://api-crm.taximonterrico.com/api/v1/inboxes/cmsf044z400067do6kds0kdph"

curl -s "${BASE}/whatsapp-templates" | jq .
```

Devuelve las plantillas **aprobadas en Meta** de la bandeja Facturación (mismo formato que la UI de Chatpool).

**Respuesta (array):**

```json
[
  {
    "id": "debito_registrado:es_PE",
    "name": "debito_registrado",
    "language": "es_PE",
    "category": "UTILITY",
    "preview": "Estimado asociado,...",
    "bodyText": "Estimado asociado,\n\n... Monto: S/ {{1}}\nMotivo: {{2}}\n\n...",
    "headerText": null,
    "headerFormat": "NONE",
    "bodyParamCount": 2,
    "headerParamCount": 0,
    "buttonUrlParamIndexes": [],
    "supported": true
  }
]
```

**Campos útiles para la integración:**

| Campo | Uso |
|-------|-----|
| `name` | Valor de `template_params.name` al enviar |
| `language` | Valor de `template_params.language` |
| `bodyParamCount` | Cuántas variables mandar en `processed_params.body` |
| `bodyParamNames` | Nombres Meta en orden (`reservation_id`, …) — útil si `parameterFormat` es `named` |
| `parameterFormat` | `named` o `positional` — define claves aceptadas en el body |
| `headerParamCount` | Variables de encabezado TEXT (si > 0) en `processed_params.header` |
| `headerMediaRequired` | **`true` = mandar `processed_params.header_media.url`** (imagen HTTPS pública) |
| `bodyText` / `headerText` | Texto con `{{1}}` o `{{nombre}}` → mapear a claves `"0"`, `"1"`, … en orden |
| `supported` | **`true` = se puede enviar por API.** Si `false`, ignorar (ej. plantilla con imagen en header) |
| `unsupportedReason` | Por qué no se puede enviar automáticamente |

**Flujo sugerido:** script de setup que llama este GET, filtra `supported: true`, y genera el YAML/config del otro sistema.

### UI de Chatpool (manual)

1. Entrar a `chat.taximonterrico.com`
2. Bandeja **Facturación** → abrir un chat → icono de plantillas en el composer

Útil para validar una plantilla puntual; para integración automatizada usar el GET anterior.

### Qué plantillas acepta Chatpool al enviar

Al hacer `POST .../messages` con `template_params`, Chatpool:

1. Busca la plantilla en Meta por `name` + `language`
2. Exige estado **APPROVED**
3. Valida que manden **todas** las variables (`bodyParamCount`, `headerParamCount`, botones URL)
4. Plantillas con header **IMAGE**: mandar URL pública en `header_media` (ver abajo)
5. Rechaza header VIDEO/DOCUMENT/LOCATION (`supported: false`)

Si el nombre o idioma no coinciden exactamente → error `TEMPLATE_NOT_FOUND`.

### Plantillas con imagen en el encabezado (QR, banner)

**Mejor opción:** URL HTTPS pública en `header_media`. Meta descarga la imagen al enviar (ideal para QR en CDN).

Requisitos de la URL:

- HTTPS accesible desde internet (Meta la descarga)
- JPG o PNG recomendado
- Sin autenticación en la URL

**Ejemplo:** `confirmar_reserva_evento` (Call center)

```json
{
  "phone": "51987654321",
  "name": "Conductor Prueba",
  "template_params": {
    "name": "confirmar_reserva_evento",
    "language": "es_PE",
    "processed_params": {
      "header_media": {
        "type": "image",
        "url": "https://cdn.ejemplo.com/qr-reserva.png"
      },
      "body": {
        "0": "123456",
        "1": "14/08/2026",
        "2": "20:45",
        "3": "SAN BORJA - LINCE",
        "4": "12345"
      }
    }
  },
  "client_message_id": "reserva-123-51987654321"
}
```

**Alternativa con nombres** (si `parameterFormat` es `named`):

```json
"body": {
  "reservation_id": "123456",
  "reservation_date": "14/08/2026",
  "reservation_time": "20:45",
  "route": "SAN BORJA - LINCE",
  "security_code": "12345"
}
```

En el GET de plantillas, si `"headerMediaRequired": true` hay que incluir `header_media`. También acepta `"link"` en lugar de `"url"`.

### Variables del body (`processed_params.body`)

Chatpool acepta **dos formatos** (según `parameterFormat` del GET):

**1. Posicional (plantillas con `{{1}}`, `{{2}}`… o `parameterFormat: "positional"`):**

```json
"body": { "0": "valor para {{1}}", "1": "valor para {{2}}" }
```

**2. Con nombre (plantillas con `{{reservation_id}}`, `{{route}}`… o `parameterFormat: "named"`):**

```json
"body": {
  "reservation_id": "123456",
  "reservation_date": "14/08/2026",
  "reservation_time": "20:45",
  "route": "SAN BORJA - LINCE",
  "security_code": "12345"
}
```

También puedes seguir usando `"0"`, `"1"`, … en plantillas named (orden según `bodyParamNames` del GET). Chatpool traduce a `parameter_name` al enviar a Meta.

---

## Flujo por cada envío (recomendado)

```
┌─────────────────┐     POST /messages/send-template   ┌──────────┐
│ Sistema         │ ─────────────────────────────────► │ Chatpool │
│ Facturación     │     { phone, name, template_params}│          │
│                 │ ◄───────────────────────────────── │          │
│                 │     contact + conversation + msg   │          │
└─────────────────┘                                    └──────────┘
                                                              │
                                                              ▼
                                                         Meta WhatsApp
                                                              │
                                                              ▼
                                                         Conductor
```

---

## Endpoint principal — Enviar plantilla por teléfono (1 POST)

Abre o reutiliza la conversación **y** envía la plantilla en una sola llamada.

### Request

```http
POST /api/v1/inboxes/cmsf044z400067do6kds0kdph/messages/send-template
Content-Type: application/json
```

### Ejemplo: `descuento_programado` (Nuevo Descuento → Guardar)

```json
{
  "phone": "51987654321",
  "name": "Mirko Yacsahuache Alvarado",
  "template_params": {
    "name": "descuento_programado",
    "language": "es_PE",
    "processed_params": {
      "body": {
        "0": "PRESTAMOS JG",
        "1": "12",
        "2": "14/08/2026",
        "3": "Observaciones del descuento"
      }
    }
  },
  "client_message_id": "descuento-8842-51987654321"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `phone` | string | Sí* | WhatsApp solo dígitos. Alias: `source_id` |
| `name` | string | No | Nombre del contacto en Chatpool |
| `template_params` | object | Sí | Plantilla Meta (`name`, `language`, variables) |
| `client_message_id` | string | No | Idempotencia por conversación (max 128) |

\* `phone` o `source_id`.

> **Sin `content`:** Chatpool arma el texto del chat a partir de la plantilla y las variables. Meta recibe solo la plantilla (`template_params`).

### Response `200 OK`

```json
{
  "contact": { "id": "...", "phone": "51987654321", "name": "..." },
  "conversation": { "id": "clconv...", "inboxId": "...", "status": "open" },
  "reopened": false,
  "message": {
    "id": "clmsg...",
    "conversationId": "clconv...",
    "senderType": "bot",
    "status": "pending",
    "clientMessageId": "descuento-8842-51987654321"
  }
}
```

### Ejemplo curl

```bash
BASE="https://api-crm.taximonterrico.com/api/v1/inboxes/cmsf044z400067do6kds0kdph"

curl -s -X POST "${BASE}/messages/send-template" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "51987654321",
    "name": "Conductor Demo",
    "template_params": {
      "name": "descuento_programado",
      "language": "es_PE",
      "processed_params": {
        "body": { "0": "PRESTAMOS JG", "1": "12", "2": "14/08/2026", "3": "-" }
      }
    },
    "client_message_id": "descuento-test-51987654321"
  }' | jq .
```

### Pseudocódigo — Guardar descuento + WhatsApp

```python
APP_BASE = f"{BACKEND}/api/v1/inboxes/{INBOX_ID}"
TPL = config.chatpool.templates.nuevo_descuento  # name: descuento_programado

for conductor in conductores_seleccionados:
    guardar_descuento_en_bd(conductor, form)

    post(f"{APP_BASE}/messages/send-template", json={
        "phone": normalizar(conductor.telefono),
        "name": conductor.nombre,
        "template_params": {
            "name": TPL.name,
            "language": TPL.language,
            "processed_params": {
                "body": {
                    "0": form.tipo_descuento,
                    "1": str(form.monto),
                    "2": form.fecha,
                    "3": form.observaciones or "-",
                }
            },
        },
        "client_message_id": f"descuento-{lote_id}-{conductor.id}",
    })
```

---

## Flujo alternativo (2 POST)

```
┌─────────────────┐     POST /conversations          ┌──────────┐
│ Sistema         │ ───────────────────────────────► │ Chatpool │
│ Facturación     │     { phone, name }              │          │
│                 │ ◄─────────────────────────────── │          │
│                 │     conversation.id              │          │
│                 │     POST .../messages            │          │
│                 │ ───────────────────────────────► │          │
└─────────────────┘                                  └──────────┘
```

---

## Endpoint alternativo 1 — Abrir conversación (2 POST)

### Request

```http
POST /api/v1/inboxes/cmsf044z400067do6kds0kdph/conversations
Content-Type: application/json
```

```json
{
  "phone": "51987654321",
  "name": "Juan Pérez López"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `phone` | string | Sí* | WhatsApp internacional solo dígitos. Alias: `source_id` |
| `name` | string | No | Nombre del contacto en Chatpool |

\* Obligatorio `phone` o `source_id`.

**Normalización de teléfono:**

- Válido: `51987654321` (E.164 sin `+`)
- Perú 9 dígitos: `987654321` → se convierte a `51987654321`
- Inválido: menos de 10 dígitos, caracteres no numéricos

### Response `200 OK`

```json
{
  "contact": {
    "id": "clxxx...",
    "phone": "51987654321",
    "name": "Juan Pérez López"
  },
  "conversation": {
    "id": "clconv...",
    "inboxId": "cmsf044z400067do6kds0kdph",
    "status": "open",
    "contact": { "...": "..." },
    "lastMessage": null,
    "unreadCount": 0,
    "botPausedUntil": null
  },
  "reopened": false,
  "createdContact": true
}
```

**Usar:** `conversation.id` como `{CONVERSATION_ID}` en el paso 2.

Si el contacto ya existía, devuelve/reabre la conversación existente (idempotente por teléfono).

---

## Endpoint alternativo 2 — Enviar plantilla (2 POST)

### Request

```http
POST /api/v1/inboxes/cmsf044z400067do6kds0kdph/conversations/{CONVERSATION_ID}/messages
Content-Type: application/json
```

### Ejemplo: `debito_registrado` (2 variables en el body)

A partir del listado de plantillas: `bodyParamCount: 2` y `bodyText` con `{{1}}` = monto, `{{2}}` = motivo.

```json
{
  "template_params": {
    "name": "debito_registrado",
    "language": "es_PE",
    "processed_params": {
      "body": {
        "0": "150.00",
        "1": "Comisión semanal"
      }
    }
  },
  "client_message_id": "debito-lote-20250814-987654321"
}
```

### Campos del body

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `template_params` | object | Sí (plantilla) | Plantilla Meta |
| `template_params.name` | string | Sí | `name` del listado de plantillas |
| `template_params.language` | string | Sí | `language` del listado |
| `template_params.processed_params.body` | object | Según `bodyParamCount` | Claves `"0"`, `"1"`, … |
| `template_params.processed_params.header` | object | Header TEXT: claves `"0"`, `"1"`, … |
| `template_params.processed_params.header_media` | object | Header IMAGE: `{ "url": "https://..." }` |
| `template_params.processed_params.buttons` | array | Si hay botones URL | Botones dinámicos |
| `content` | string | No | Solo si envías **texto libre** sin plantilla |
| `client_message_id` | string | No | Idempotencia (max 128 chars) |
| `purpose` | `"otp"` \| `"authentication"` | No | Omite bloqueo bot pausado (no aplica a débitos) |

### Orden de variables (`processed_params.body`)

| Formato | Claves en API | Ejemplo |
|---------|---------------|---------|
| Posicional (`{{1}}`, `{{2}}`) | `"0"`, `"1"`, … | `"0"` = monto, `"1"` = motivo |
| Named (`{{reservation_id}}`, …) | nombres del GET (`bodyParamNames`) **o** `"0"`, `"1"`, … en orden | `"reservation_id": "123456"` |

Usar claves numéricas `"0"`, `"1"`, … **o** los nombres exactos de `bodyParamNames` cuando `parameterFormat` es `named`.

### Response `200 OK`

```json
{
  "id": "clmsg...",
  "conversationId": "clconv...",
  "content": "Estimado asociado,...",
  "senderType": "bot",
  "status": "pending",
  "clientMessageId": "debito-lote-20250814-987654321",
  "createdAt": "2025-08-14T21:30:00.000Z"
}
```

- `status`: `pending` → enviando; luego `sent` / `delivered` / `read`.
- Si falla Meta: `status: "failed"` y `errorMessage`.

### Idempotencia

Mismo `client_message_id` en la misma conversación → no duplica; devuelve el mensaje existente.

Formato sugerido: `{tipo}-{lote_id}-{telefono}` → `debito-8842-51987654321`

---

## Ejemplo curl — flujo 2 POST (alternativo)

```bash
BASE="https://api-crm.taximonterrico.com/api/v1/inboxes/cmsf044z400067do6kds0kdph"

RESP=$(curl -s -X POST "${BASE}/conversations" \
  -H "Content-Type: application/json" \
  -d '{"phone":"51987654321","name":"Conductor Demo"}')

CONV_ID=$(echo "$RESP" | jq -r '.conversation.id')

curl -s -X POST "${BASE}/conversations/${CONV_ID}/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "template_params": {
      "name": "debito_registrado",
      "language": "es_PE",
      "processed_params": {
        "body": { "0": "150.00", "1": "Comisión semanal" }
      }
    },
    "client_message_id": "debito-test-51987654321"
  }' | jq .
```

---

## Pseudocódigo — envío masivo (2 POST, alternativo)

```python
BACKEND = "https://api-crm.taximonterrico.com"
INBOX = "cmsf044z400067do6kds0kdph"
APP_BASE = f"{BACKEND}/api/v1/inboxes/{INBOX}"

# --- Setup (una vez): cargar plantillas desde Chatpool ---
templates = get(f"{APP_BASE}/whatsapp-templates")
TEMPLATES = {
    t["name"]: t
    for t in templates
    if t["supported"]
}

def enviar_debito(conductor, monto, observacion, lote_id):
    tpl = TEMPLATES["debito_registrado"]  # validar bodyParamCount == 2

    conv = post(f"{APP_BASE}/conversations", json={
        "phone": normalizar_telefono(conductor.telefono),
        "name": conductor.nombre,
    })
    conv_id = conv["conversation"]["id"]

    return post(f"{APP_BASE}/conversations/{conv_id}/messages", json={
        "template_params": {
            "name": tpl["name"],
            "language": tpl["language"],
            "processed_params": {
                "body": {"0": str(monto), "1": observacion}
            }
        },
        "client_message_id": f"debito-{lote_id}-{conductor.telefono}",
    })
```

---

## Errores HTTP

```json
{
  "message": "La plantilla requiere 2 variable(s) en el cuerpo",
  "code": "TEMPLATE_PARAMS_INVALID"
}
```

| HTTP | code | Causa |
|------|------|-------|
| 400 | `INVALID_CREATE_CONVERSATION` | Falta `phone` |
| 401 | `UNAUTHORIZED` | No aplica a Application API |
| 404 | `NOT_FOUND` | INBOX_ID o conversación incorrectos |
| 404 | `TEMPLATE_NOT_FOUND` | Nombre/idioma no existe o no está APPROVED en Meta |
| 422 | `INVALID_PHONE` | Teléfono mal formateado |
| 422 | `CONTACT_BLOCKED` | Contacto bloqueado |
| 422 | `BOT_PAUSED` | Bot pausado en esa conversación |
| 422 | `TEMPLATE_PARAMS_INVALID` | Variables incorrectas (revisar `bodyParamCount`) |
| 502 | `META_*` | Error al contactar Meta |

---

## Reglas importantes

1. **Dejar de enviar por Meta directo** — si no, duplicados al conductor.
2. Solo plantillas **`supported: true`** en el listado.
3. Mensajes en chat como remitente **Bot**.
4. **Bot pausado** → `BOT_PAUSED` en esa conversación.
5. Plantillas **no requieren** ventana 24h.

---

## Buscar conversation_id por teléfono (n8n / Match)

Para enviar a `POST .../conversations/{conversation_id}/messages` hay que resolver el id del chat. El teléfono se normaliza (solo dígitos; `987654321` → `51987654321`).

### Recomendado — lookup directo (sin Match)

```http
GET /api/v1/inboxes/cmsf044z400067do6kds0kdph/contacts?phone=51987654321
```

**Respuesta:**

```json
{
  "payload": [
    {
      "id": "clxxx...",
      "name": "Juan Pérez",
      "phone": "51987654321",
      "conversationId": "clconv...",
      "conversation_id": "clconv..."
    }
  ]
}
```

En n8n: HTTP Request → `{{ $json.payload[0].conversation_id }}` → POST del mensaje.

Si `payload` está vacío, ese número no existe en la bandeja. Si `conversation_id` es `null`, el contacto existe pero aún no tiene chat (usar `POST /conversations` con `{ "phone" }` para abrirlo).

### Alternativa — listar todos y hacer Match

```http
GET /api/v1/inboxes/cmsf044z400067do6kds0kdph/contacts
```

Cada ítem trae `name`, `phone` y `conversation_id`. En el nodo **Match** de n8n:

| Input | Campo |
|-------|--------|
| Input_Recibido | `phone` |
| GET /contacts (`payload`) | `phone` |

Salida del Match: `conversation_id` → URL:

```
POST /api/v1/inboxes/{{ inbox_id }}/conversations/{{ conversation_id }}/messages
```

También sirve `GET /conversations?phone=51987654321` (el id está en `data.payload[0].id` y el teléfono en `contact.phone`).

---

## Endpoints adicionales (Application API)

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/v1/inboxes/{id}` | Detalle de la bandeja |
| GET | `/whatsapp-templates` | Plantillas aprobadas (Meta) |
| POST | `/messages/send-template` | **Enviar plantilla por teléfono (1 POST)** |
| GET | `/conversations` | Listar chats (`?phone=` opcional) |
| GET | `/conversations/{id}/messages` | Historial |
| GET | `/contacts` | Contactos + `conversation_id` (`?phone=` opcional) |
| POST | `/conversations/{id}/toggle_status` | `{ "status": "open" \| "resolved" }` |
| POST | `/conversations/{id}/labels` | `{ "labels": ["debito"] }` |

---

## Checklist de puesta en marcha

- [ ] Confirmar URL backend con `GET /health` → `chatpool-api`
- [ ] Confirmar `INBOX_ID` Facturación
- [ ] `GET .../whatsapp-templates` → armar config de plantillas
- [ ] Probar 1 envío con `POST .../messages/send-template`
- [ ] Verificar mensaje en UI Chatpool
- [ ] Migrar loop masivo; desactivar Meta directo
- [ ] Restringir `/api/v1/` por IP en nginx

---

Documentación adicional: `backend/README.md` (Application API).
