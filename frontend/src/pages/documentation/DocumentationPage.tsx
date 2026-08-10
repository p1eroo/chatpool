import { useMemo, useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { env } from "@/config/env";
import { cn } from "@/lib/utils";

type HttpMethod = "GET" | "POST";
type CodeView = "url" | "curl";

interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  title: string;
  purpose: string;
  queryExample?: string;
  body?: string;
  /** Sustituye placeholders en el path para el ejemplo curl (ej. :id → CONVERSATION_ID). */
  pathExample?: string;
}

const CATALOG_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/profile",
    title: "Perfil API",
    purpose:
      "Devuelve el agente que Chatpool usa al ejecutar acciones desde n8n (mensajes, labels, etc.). Útil para verificar qué usuario está actuando en tus flujos.",
  },
  {
    method: "GET",
    path: "/inboxes",
    title: "Bandejas",
    purpose:
      "Lista las bandejas (canales) disponibles. Úsalo en n8n para obtener el inbox_id antes de crear conversaciones o filtrar contactos.",
  },
  {
    method: "GET",
    path: "/labels",
    title: "Etiquetas",
    purpose:
      "Lista todas las etiquetas de la instalación. Sirve para conocer los nombres exactos antes de asignarlas a una conversación.",
  },
  {
    method: "GET",
    path: "/agents",
    title: "Agentes",
    purpose:
      "Lista agentes del equipo. Úsalo para obtener el assignee_id al asignar conversaciones desde un flujo automatizado.",
  },
  {
    method: "GET",
    path: "/contacts",
    title: "Contactos",
    purpose:
      "Lista contactos. Con varias bandejas (Call center, Facturación, etc.) filtra siempre con inbox_id para no mezclar canales.",
    queryExample: "?inbox_id=INBOX_ID",
  },
  {
    method: "GET",
    path: "/contacts/:id",
    title: "Detalle de contacto",
    purpose:
      "Obtiene un contacto por ID (nombre, teléfono, ciudad, empresa, bloqueo). Ideal para enriquecer un flujo con datos del cliente.",
    pathExample: "/contacts/CONTACT_ID",
  },
];

const CONVERSATION_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/conversations",
    title: "Listar conversaciones",
    purpose:
      "Obtiene conversaciones con filtros. Usa inbox_id obligatorio en n8n si hay varias bandejas, para no mezclar Call center con Facturación, etc.",
    queryExample: "?status=open&inbox_id=INBOX_ID&assignee_type=unassigned",
  },
  {
    method: "GET",
    path: "/conversations/:id",
    title: "Detalle de conversación",
    purpose:
      "Devuelve una conversación con contacto, etiquetas, assignee y último mensaje. Úsalo como paso previo a enviar o etiquetar.",
    pathExample: "/conversations/CONVERSATION_ID",
  },
  {
    method: "POST",
    path: "/conversations",
    title: "Iniciar conversación WhatsApp",
    purpose:
      "Crea o reabre una conversación outbound por número. Luego envía un template (ventana 24h) con el endpoint de mensajes.",
    body: `{
  "inbox_id": "INBOX_ID",
  "phone": "51987654321",
  "name": "Nombre opcional"
}`,
  },
  {
    method: "GET",
    path: "/conversations/:id/messages",
    title: "Historial de mensajes",
    purpose:
      "Lista los mensajes del hilo. Sirve para contexto de bots, resúmenes o decidir la siguiente respuesta en n8n.",
    pathExample: "/conversations/CONVERSATION_ID/messages",
  },
  {
    method: "POST",
    path: "/conversations/:id/messages",
    title: "Enviar mensaje",
    purpose:
      "Envía un mensaje de texto (o nota privada). Usa el CONVERSATION_ID del payload del webhook saliente: la conversación ya pertenece a una bandeja (no hace falta inbox_id aquí). También admite templates con template_params.",
    pathExample: "/conversations/CONVERSATION_ID/messages",
    body: `{
  "content": "Hola desde n8n",
  "private": false
}`,
  },
  {
    method: "GET",
    path: "/conversations/:id/labels",
    title: "Ver etiquetas",
    purpose:
      "Devuelve los nombres de etiquetas actuales de la conversación. Útil para condiciones (si tiene X, entonces…).",
    pathExample: "/conversations/CONVERSATION_ID/labels",
  },
  {
    method: "POST",
    path: "/conversations/:id/labels",
    title: "Actualizar etiquetas",
    purpose:
      "Reemplaza todas las etiquetas de la conversación por la lista enviada (como Chatwoot). Crea la etiqueta en la bandeja si no existe.",
    pathExample: "/conversations/CONVERSATION_ID/labels",
    body: `{
  "labels": ["soporte", "vip"]
}`,
  },
  {
    method: "POST",
    path: "/conversations/:id/toggle_status",
    title: "Abrir / resolver",
    purpose:
      "Cambia el estado a open o resolved. Ideal al cerrar un caso desde n8n cuando el flujo termina.",
    pathExample: "/conversations/CONVERSATION_ID/toggle_status",
    body: `{
  "status": "resolved"
}`,
  },
  {
    method: "POST",
    path: "/conversations/:id/assignments",
    title: "Asignar agente",
    purpose:
      "Asigna la conversación a un agente (assignee_id) o desasigna con null. Combínalo con GET /agents para elegir el responsable.",
    pathExample: "/conversations/CONVERSATION_ID/assignments",
    body: `{
  "assignee_id": "AGENT_ID"
}`,
  },
];

const TEMPLATE_BODY = `{
  "content": "Vista previa del template",
  "template_params": {
    "name": "nombre_template",
    "language": "es",
    "processed_params": {
      "body": { "1": "valor" }
    }
  }
}`;

function resolvePath(endpoint: ApiEndpoint): string {
  return endpoint.pathExample ?? endpoint.path;
}

function buildUrl(basePath: string, endpoint: ApiEndpoint): string {
  return `${basePath}${resolvePath(endpoint)}${endpoint.queryExample ?? ""}`;
}

function buildCurl(basePath: string, endpoint: ApiEndpoint): string {
  const url = buildUrl(basePath, endpoint);
  if (endpoint.method === "GET") {
    return `curl "${url}"`;
  }

  const body = endpoint.body ?? "{}";
  const compact = body.replace(/\s+/g, " ").trim();
  return `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${compact}'`;
}

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[3.25rem] px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide shrink-0",
        method === "GET" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        method === "POST" && "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
      )}
    >
      {method}
    </span>
  );
}

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 h-7 px-2 text-[11px] font-medium rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {copied ? "Copiado" : label}
    </button>
  );
}

function EndpointCard({
  basePath,
  endpoint,
}: {
  basePath: string;
  endpoint: ApiEndpoint;
}) {
  const [view, setView] = useState<CodeView>("url");
  const url = buildUrl(basePath, endpoint);
  const curl = buildCurl(basePath, endpoint);
  const activeCode = view === "url" ? url : curl;

  return (
    <article className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 flex flex-col gap-3 h-full">
      <div className="flex items-start gap-2.5">
        <MethodBadge method={endpoint.method} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
            {endpoint.title}
          </h3>
          <code className="text-[11px] font-mono text-[var(--color-text-muted)] break-all">
            {endpoint.path}
            {endpoint.queryExample ? " + query" : ""}
          </code>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        {endpoint.purpose}
      </p>

      {endpoint.body && (
        <div>
          <p className="text-[11px] font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wide">
            Body JSON
          </p>
          <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)] rounded-lg p-2.5 text-[var(--color-text-primary)]">
            {endpoint.body}
          </pre>
        </div>
      )}

      <div className="mt-auto pt-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg bg-[var(--color-bg-tertiary)] p-0.5">
            <button
              type="button"
              onClick={() => setView("url")}
              className={cn(
                "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors",
                view === "url"
                  ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              URL
            </button>
            <button
              type="button"
              onClick={() => setView("curl")}
              className={cn(
                "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors inline-flex items-center gap-1",
                view === "curl"
                  ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              <Terminal className="w-3 h-3" />
              cURL
            </button>
          </div>
          <CopyButton text={activeCode} label={view === "curl" ? "Copiar cURL" : "Copiar URL"} />
        </div>
        <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)] rounded-lg p-2.5 text-[var(--color-text-primary)] min-h-[3.25rem]">
          {activeCode}
        </pre>
      </div>
    </article>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
      <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">{description}</p>
    </div>
  );
}

export function DocumentationPage() {
  const apiBase = env.apiUrl.replace(/\/$/, "");
  const accountId = env.apiAccountId;
  const accountBase = useMemo(
    () => `${apiBase}/api/v1/accounts/${accountId}`,
    [apiBase, accountId]
  );

  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-y-auto">
      <div className="w-full px-5 py-5 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Documentación
            </h1>
            <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5 max-w-2xl">
              APIs externas estilo Chatwoot para automatizaciones con n8n. Sin autenticación;
              pensadas para red confiable. El aislamiento entre canales es por bandeja
              (<code className="font-mono text-[12px]"> inbox_id</code>).
            </p>
          </div>
          <div className="flex items-center gap-2 min-w-0 lg:max-w-xl w-full lg:w-auto">
            <div className="min-w-0 flex-1 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-0.5">
                Base URL
              </p>
              <code className="text-[12px] font-mono text-[var(--color-text-primary)] break-all">
                {accountBase}
              </code>
            </div>
            <CopyButton text={accountBase} />
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-3">
            <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              Auth
            </p>
            <p className="text-[13px] text-[var(--color-text-primary)] mt-1">
              Sin token. El panel interno sigue con JWT.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-3">
            <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              Account / bandejas
            </p>
            <p className="text-[13px] text-[var(--color-text-primary)] mt-1">
              <code className="font-mono text-[12px]">/accounts/{accountId}</code> = instalación
              (<code className="font-mono text-[11px]">API_ACCOUNT_ID</code>). Call center,
              Facturación, Flota… se separan con <code className="font-mono text-[11px]">inbox_id</code>.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-3">
            <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              n8n
            </p>
            <p className="text-[13px] text-[var(--color-text-primary)] mt-1">
              Usa el nodo HTTP Request. Copia URL o cURL desde cada tarjeta.
            </p>
          </div>
        </div>

        <section className="mb-8">
          <SectionHeader
            title="Catálogos"
            description="Datos de referencia para armar flujos: bandejas, agentes, contactos y etiquetas"
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CATALOG_ENDPOINTS.map((endpoint) => (
              <EndpointCard
                key={`${endpoint.method}-${endpoint.path}`}
                basePath={accountBase}
                endpoint={endpoint}
              />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <SectionHeader
            title="Conversaciones y mensajes"
            description="Núcleo operativo: leer hilos, enviar WhatsApp, etiquetar, resolver y asignar"
          />
          <div className="grid gap-3 md:grid-cols-2">
            {CONVERSATION_ENDPOINTS.map((endpoint) => (
              <EndpointCard
                key={`${endpoint.method}-${endpoint.path}`}
                basePath={accountBase}
                endpoint={endpoint}
              />
            ))}
          </div>
        </section>

        <section className="mb-4">
          <SectionHeader
            title="Template WhatsApp"
            description="En POST /conversations/:id/messages puedes enviar un template aprobado con template_params"
          />
          <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-3">
                Fuera de la ventana de 24 horas de WhatsApp solo puedes enviar templates
                preaprobados. Usa este body en el mismo endpoint de mensajes; los parámetros
                del body se mapean en orden a las variables del template.
              </p>
              <CopyButton
                text={buildCurl(accountBase, {
                  method: "POST",
                  path: "/conversations/:id/messages",
                  pathExample: "/conversations/CONVERSATION_ID/messages",
                  title: "Template",
                  purpose: "",
                  body: TEMPLATE_BODY,
                })}
                label="Copiar cURL template"
              />
            </div>
            <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)] rounded-lg p-3 text-[var(--color-text-primary)]">
              {TEMPLATE_BODY}
            </pre>
          </div>
        </section>

        <section className="mb-8 mt-8">
          <SectionHeader
            title="Webhooks salientes"
            description="Chatpool notifica a URLs externas (n8n, Zapier, etc.). Configúralos en Ajustes → Integraciones → Webhook eligiendo la bandeja. Un webhook de Call center no recibe eventos de Facturación."
          />
          <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
                  Eventos
                </p>
                <ul className="text-[12px] font-mono text-[var(--color-text-primary)] space-y-1">
                  <li>message_created</li>
                  <li>message_updated</li>
                  <li>conversation_created</li>
                  <li>conversation_updated</li>
                  <li>conversation_status_changed</li>
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
                  Entrega
                </p>
                <ul className="text-[12px] text-[var(--color-text-primary)] space-y-1">
                  <li>POST JSON a la URL configurada</li>
                  <li className="font-mono">Header: X-Chatpool-Event</li>
                  <li>Body: {"{ event, ...payload }"}</li>
                  <li className="font-mono">conversation_id (top-level)</li>
                  <li className="font-mono">inbox.id / conversation.inbox_id</li>
                </ul>
              </div>
            </div>
            <p className="text-[12px] text-[var(--color-text-secondary)]">
              En n8n usa el nodo <strong>Webhook</strong> con Authentication = None y la{" "}
              <strong>Production URL</strong> (workflow Active). Para responder, usa{" "}
              <code className="font-mono text-[11px]">conversation_id</code> del JSON en{" "}
              <code className="font-mono text-[11px]">POST .../conversations/:id/messages</code>:
              así el mensaje vuelve a la misma bandeja.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
