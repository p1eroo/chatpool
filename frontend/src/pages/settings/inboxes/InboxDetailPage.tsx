import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Plus } from "lucide-react";
import { CopyableValueRow } from "@/components/settings/CopyableValueRow";
import { CreateLabelModal } from "@/components/settings/CreateLabelModal";
import { LabelColorDot } from "@/components/settings/LabelColorDot";
import { MetaInboxIntegrationPanel } from "@/components/settings/MetaInboxIntegrationPanel";
import { useIntegrationStore } from "@/store/integrationStore";
import { useLabelStore } from "@/store/labelStore";
import { normalizeHexColor } from "@/lib/labelColorUtils";
import { useRoleStore } from "@/store/roleStore";
import { useAgentStore } from "@/store/agentStore";
import { useInboxStore } from "@/store/inboxStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { useUIStore } from "@/store/uiStore";
import {
  InboxStatusBadge,
  SettingsField,
  SettingsSection,
} from "@/components/settings/SettingsSection";

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Correo electrónico",
  facebook: "Facebook Messenger",
  website: "Chat web",
  instagram: "Instagram DM",
};

const providerLabels: Record<string, string> = {
  meta: "Meta API",
  email: "Correo SMTP",
  website: "Chat Web",
};

export function InboxDetailPage() {
  const { inboxId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const showToast = useUIStore((s) => s.showToast);
  const getByInboxId = useInboxSettingsStore((s) => s.getByInboxId);
  const getInboxById = useInboxStore((s) => s.getInboxById);
  const getLabelsForInbox = useLabelStore((s) => s.getLabelsForInbox);
  const createLabel = useLabelStore((s) => s.createLabel);
  const getAccountByProvider = useIntegrationStore((s) => s.getAccountByProvider);
  const integrationRef = useRef<HTMLElement>(null);

  const inbox = getInboxById(inboxId);
  const config = getByInboxId(inboxId);
  const inboxLabels = getLabelsForInbox(inboxId);
  const integration = config ? getAccountByProvider(config.provider) : undefined;
  const getRoleName = useRoleStore((s) => s.getRoleName);
  const agents = useAgentStore((s) => s.agents);
  const assignedAgents = agents.filter((agent) => config?.assignedAgentIds.includes(agent.id));

  useEffect(() => {
    if (searchParams.get("section") === "integration") {
      integrationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searchParams]);

  if (!inbox || !config) {
    return <Navigate to="/settings/inboxes" replace />;
  }

  const copyWebhook = () => {
    if (!config.webhookUrl) return;
    void navigator.clipboard.writeText(config.webhookUrl);
    showToast("Webhook copiado");
  };

  const copyVerifyToken = () => {
    if (!config.webhookVerifyToken) return;
    void navigator.clipboard.writeText(config.webhookVerifyToken);
    showToast("Verify token copiado");
  };

  const isMetaChannel = config.provider === "meta";

  const handleCreateLabel = async (name: string, color: string) => {
    const ok = await createLabel(inboxId, name, color);
    if (ok) {
      showToast("Etiqueta creada");
    }
    return ok;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/settings/inboxes"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          title="Volver a bandejas"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{inbox.name}</h2>
            <InboxStatusBadge status={config.status} />
          </div>
          <p className="text-[12px] text-[var(--color-text-muted)]">
            Configuración de esta bandeja · {channelLabels[inbox.channelType] ?? inbox.channelType}
          </p>
        </div>
      </div>

      <SettingsSection title="General" description="Identidad y estado del canal">
        <SettingsField label="Nombre" value={inbox.name} />
        <SettingsField label="Canal" value={channelLabels[inbox.channelType] ?? inbox.channelType} />
        <SettingsField label="Identificador" value={config.detail} mono />
        <SettingsField label="Estado" value={<InboxStatusBadge status={config.status} />} />
        {config.description && <SettingsField label="Descripción" value={config.description} />}
      </SettingsSection>

      <SettingsSection
        title={`Etiquetas (${inboxLabels.length})`}
        description="Etiquetas disponibles solo en esta bandeja"
        action={
          <button
            type="button"
            onClick={() => setLabelModalOpen(true)}
            className="h-8 px-3 text-xs font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva
          </button>
        }
      >
        {inboxLabels.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Esta bandeja aún no tiene etiquetas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {inboxLabels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              >
                <LabelColorDot color={label.color} className="w-2 h-2" />
                {label.name}
                <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                  {normalizeHexColor(label.color)}
                </span>
              </span>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title={`Agentes (${assignedAgents.length})`}
        description="Vista de acceso desde esta bandeja. Edita la asignación en Ajustes → Agentes."
      >
        <div className="space-y-2">
          {assignedAgents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)]"
            >
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">{agent.name}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{getRoleName(agent.roleId)}</p>
              </div>
              <Link
                to="/settings/agents"
                className="text-[11px] text-[var(--color-brand)] hover:underline"
              >
                Gestionar
              </Link>
            </div>
          ))}
        </div>
      </SettingsSection>

      <section ref={integrationRef}>
        <SettingsSection
          title="Integración"
          description="Conexión del canal con el proveedor externo"
          action={
            integration && (
              <Link
                to="/settings/integrations"
                className="h-8 px-3 text-xs font-medium rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver detalle global
              </Link>
            )
          }
        >
          <SettingsField
            label="Proveedor"
            value={integration?.name ?? providerLabels[config.provider] ?? config.provider}
          />
          <SettingsField label="Recurso conectado" value={config.providerResource} />
          <SettingsField
            label="Estado de conexión"
            value={
              config.status === "active" ? (
                <span className="text-[var(--color-success)]">Conectado</span>
              ) : (
                <span className="text-[var(--color-warning)]">Pendiente de verificación</span>
              )
            }
          />
          {config.webhookUrl && (
            <CopyableValueRow
              label="Webhook"
              value={config.webhookUrl}
              onCopy={copyWebhook}
              hint="Callback URL por bandeja en Meta Developer Console"
            />
          )}

          {config.webhookVerifyToken && (
            <CopyableValueRow
              label="Verify token"
              value={config.webhookVerifyToken}
              onCopy={copyVerifyToken}
              hint="Úsalo junto a esta URL de webhook (no es el token global)"
            />
          )}

          {isMetaChannel && (
            <MetaInboxIntegrationPanel
              inboxId={inboxId}
              config={config}
              onVerified={(message) => showToast(message)}
              onError={(message) => showToast(message)}
            />
          )}
        </SettingsSection>
      </section>

      <CreateLabelModal
        open={labelModalOpen}
        onClose={() => setLabelModalOpen(false)}
        onCreate={handleCreateLabel}
      />
    </div>
  );
}
