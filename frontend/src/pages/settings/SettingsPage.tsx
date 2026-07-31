import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  Plus,
  Settings2,
  Copy,
  MoreVertical,
} from "lucide-react";

type SettingsTab = "inboxes" | "agents" | "labels" | "integrations";

const tabs: { id: SettingsTab; label: string }[] = [
  { id: "inboxes", label: "Bandejas" },
  { id: "agents", label: "Agentes" },
  { id: "labels", label: "Etiquetas" },
  { id: "integrations", label: "Integraciones" },
];

const agents = [
  { id: "agent-1", name: "Carlos Mendoza", email: "carlos@chatpool.com", role: "Administrador", status: "online" as const },
  { id: "agent-2", name: "Ana Torres", email: "ana@chatpool.com", role: "Agente", status: "away" as const },
  { id: "agent-3", name: "Luis García", email: "luis@chatpool.com", role: "Agente", status: "offline" as const },
];

const configuredLabels = [
  { id: "label-1", name: "soporte", color: "bg-purple-500", conversations: 24 },
  { id: "label-2", name: "urgente", color: "bg-red-500", conversations: 8 },
  { id: "label-3", name: "facturación", color: "bg-blue-500", conversations: 15 },
  { id: "label-4", name: "envío", color: "bg-orange-500", conversations: 12 },
  { id: "label-5", name: "consulta", color: "bg-emerald-500", conversations: 32 },
  { id: "label-6", name: "reclamo", color: "bg-amber-500", conversations: 18 },
];

const configuredInboxes = [
  { name: "WhatsApp Support", channel: "whatsapp", status: "active", detail: "+51 987 654 321" },
  { name: "Correo Electrónico", channel: "email", status: "active", detail: "soporte@chatpool.com" },
  { name: "Facebook Messenger", channel: "facebook", status: "active", detail: "PoolTech Oficial" },
  { name: "Chat Web", channel: "website", status: "active", detail: "app.chatpool.com" },
  { name: "Instagram DM", channel: "instagram", status: "pending", detail: "@pooltech_oficial" },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("inboxes");

  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-y-auto">
      <div className="mx-auto max-w-6xl w-full p-6">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Configuración</h1>
        <p className="text-[13px] text-[var(--color-text-muted)] mb-4">
          Gestiona la configuración de tu cuenta
        </p>

        <div className="flex gap-0.5 mb-4 bg-[var(--color-bg-secondary)] rounded-lg p-0.5 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-1.5 text-[13px] rounded-md transition-colors font-medium",
                activeTab === tab.id
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "agents" && <AgentsSettings />}
        {activeTab === "labels" && <LabelsSettings />}
        {activeTab === "inboxes" && <InboxesSettings />}
        {activeTab === "integrations" && <IntegrationsSettings />}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action: { label: string } }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-primary)]">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
      </div>
      <button className="h-8 px-3 text-xs font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        {action.label}
      </button>
    </div>
  );
}

function AgentsSettings() {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-lg overflow-hidden">
      <SectionHeader title={`Agentes (${agents.length})`} subtitle="Gestiona los agentes de tu equipo" action={{ label: "Invitar" }} />
      <div className="divide-y divide-[var(--color-border-primary)]">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-hover)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar name={agent.name} size="md" />
                <StatusDot status={agent.status} className="absolute -bottom-0.5 -right-0.5 !border-[var(--color-bg-secondary)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{agent.name}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">{agent.email} — {agent.role}</p>
              </div>
            </div>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabelsSettings() {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-lg overflow-hidden">
      <SectionHeader title={`Etiquetas (${configuredLabels.length})`} subtitle="Organiza las conversaciones con etiquetas" action={{ label: "Nueva" }} />
      <div className="divide-y divide-[var(--color-border-primary)]">
        {configuredLabels.map((label) => (
          <div key={label.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-hover)] transition-colors">
            <div className="flex items-center gap-3">
              <span className={cn("w-3 h-3 rounded-full", label.color)} />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{label.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[12px] text-[var(--color-text-muted)]">{label.conversations} conversaciones</span>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InboxesSettings() {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-lg overflow-hidden">
      <SectionHeader title={`Bandejas (${configuredInboxes.length})`} subtitle="Configura los canales de atención" action={{ label: "Nueva" }} />
      <div className="divide-y divide-[var(--color-border-primary)]">
        {configuredInboxes.map((inbox) => (
          <div key={inbox.name} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-hover)] transition-colors">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{inbox.name}</p>
              <p className="text-[12px] text-[var(--color-text-muted)]">{inbox.detail}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-[11px] px-2 py-0.5 rounded-full font-medium",
                inbox.status === "active"
                  ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                  : "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
              )}>
                {inbox.status === "active" ? "Activo" : "Pendiente"}
              </span>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsSettings() {
  return (
    <div className="space-y-3">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Meta API</h3>
              <p className="text-[12px] text-[var(--color-text-muted)]">WhatsApp, Facebook e Instagram</p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)] font-medium">
            Conectado
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2.5">WhatsApp Numbers</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-[var(--color-bg-tertiary)] rounded-lg">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 bg-[var(--color-success)] rounded-full" />
                  <div>
                    <p className="text-[13px] text-[var(--color-text-primary)]">+51 987 654 321</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">PoolTech Support</p>
                  </div>
                </div>
                <span className="text-[10px] text-[var(--color-success)] font-medium">Activo</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[var(--color-bg-tertiary)] rounded-lg">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 bg-[var(--color-warning)] rounded-full" />
                  <div>
                    <p className="text-[13px] text-[var(--color-text-primary)]">+51 999 111 222</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">PoolTech Ventas</p>
                  </div>
                </div>
                <span className="text-[10px] text-[var(--color-warning)] font-medium">Pendiente</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2.5">Facebook Pages</h4>
            <div className="p-2.5 bg-[var(--color-bg-tertiary)] rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 bg-[var(--color-success)] rounded-full" />
                <div>
                  <p className="text-[13px] text-[var(--color-text-primary)]">PoolTech Oficial</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">125K seguidores</p>
                </div>
              </div>
              <span className="text-[10px] text-[var(--color-success)] font-medium">Activo</span>
            </div>
          </div>

          <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3">
            <h4 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Webhook</h4>
            <div className="flex items-center justify-between">
              <code className="text-[12px] text-[var(--color-text-secondary)] truncate">https://api.chatpool.app/webhooks/meta</code>
              <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0 ml-2" title="Copiar">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
