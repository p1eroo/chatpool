import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { CopyableValueRow } from "@/components/settings/CopyableValueRow";
import { CreateLabelModal } from "@/components/settings/CreateLabelModal";
import { MetaInboxIntegrationPanel } from "@/components/settings/MetaInboxIntegrationPanel";
import { SettingsModal, SettingsToggle } from "@/components/settings/SettingsModal";
import { LabelChip } from "@/components/ui/LabelChip";
import { useIntegrationStore } from "@/store/integrationStore";
import { useLabelStore } from "@/store/labelStore";
import { useConversationStore } from "@/store/conversationStore";
import { useInboxLabelAccentMap } from "@/hooks/useInboxLabelAccentMap";
import { useRoleStore } from "@/store/roleStore";
import { useAgentStore } from "@/store/agentStore";
import { useInboxStore } from "@/store/inboxStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { useUIStore } from "@/store/uiStore";
import { inboxApiService } from "@/services/inboxApiService";
import { env } from "@/config/env";
import type { Label } from "@/types";
import {
  InboxStatusBadge,
  SettingsField,
  SettingsSection,
} from "@/components/settings/SettingsSection";

const BOT_PAUSE_MIN = 1;
const BOT_PAUSE_MAX = 1440;

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
  const [labelPendingEdit, setLabelPendingEdit] = useState<Label | null>(null);
  const [labelPendingDelete, setLabelPendingDelete] = useState<Label | null>(null);
  const [botPauseMinutes, setBotPauseMinutes] = useState("");
  const [savingBot, setSavingBot] = useState(false);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [autoAssignAgentIds, setAutoAssignAgentIds] = useState<string[]>([]);
  const [savingAutoAssign, setSavingAutoAssign] = useState(false);
  const showToast = useUIStore((s) => s.showToast);
  const getByInboxId = useInboxSettingsStore((s) => s.getByInboxId);
  const updateSettings = useInboxSettingsStore((s) => s.updateSettings);
  const getInboxById = useInboxStore((s) => s.getInboxById);
  const createLabel = useLabelStore((s) => s.createLabel);
  const updateLabel = useLabelStore((s) => s.updateLabel);
  const deleteLabel = useLabelStore((s) => s.deleteLabel);
  const getLabelById = useLabelStore((s) => s.getLabelById);
  const labels = useLabelStore((s) => s.labels);
  const inboxLabels = labels.filter((label) => label.inboxId === inboxId);
  const labelAccentById = useInboxLabelAccentMap(inboxId);
  const removeLabelFromAllConversations = useConversationStore(
    (s) => s.removeLabelFromAllConversations
  );
  const syncLabelInConversations = useConversationStore(
    (s) => s.syncLabelInConversations
  );
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);
  const getAccountByProvider = useIntegrationStore((s) => s.getAccountByProvider);
  const integrationRef = useRef<HTMLElement>(null);

  const inbox = getInboxById(inboxId);
  const config = getByInboxId(inboxId);
  const integration = config ? getAccountByProvider(config.provider) : undefined;
  const getRoleName = useRoleStore((s) => s.getRoleName);
  const agents = useAgentStore((s) => s.agents);
  const assignedAgents = agents.filter((agent) => config?.assignedAgentIds.includes(agent.id));

  useEffect(() => {
    if (searchParams.get("section") === "integration") {
      integrationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searchParams]);

  useEffect(() => {
    if (config) {
      setBotPauseMinutes(String(config.botPauseMinutes ?? 15));
      setAutoAssignEnabled(config.autoAssignEnabled ?? false);
      setAutoAssignAgentIds(
        config.autoAssignAgentIds ?? config.assignedAgentIds ?? []
      );
    }
  }, [
    config?.inboxId,
    config?.botPauseMinutes,
    config?.autoAssignEnabled,
    config?.autoAssignAgentIds,
    config?.assignedAgentIds,
  ]);

  if (!inbox || !config) {
    return <Navigate to="/settings/inboxes" replace />;
  }

  const handleSaveBotPause = async () => {
    const parsed = Number(botPauseMinutes);
    if (
      !Number.isInteger(parsed) ||
      parsed < BOT_PAUSE_MIN ||
      parsed > BOT_PAUSE_MAX
    ) {
      showToast(`Ingresa un número entero entre ${BOT_PAUSE_MIN} y ${BOT_PAUSE_MAX}`);
      return;
    }

    setSavingBot(true);
    try {
      if (env.useMock) {
        updateSettings(inboxId, { botPauseMinutes: parsed });
      } else {
        const updated = await inboxApiService.updateSettings(inboxId, {
          botPauseMinutes: parsed,
        });
        updateSettings(inboxId, { botPauseMinutes: updated.botPauseMinutes });
      }
      showToast("Configuración del bot guardada");
    } catch {
      showToast("No se pudo guardar la configuración del bot");
    } finally {
      setSavingBot(false);
    }
  };

  const toggleAutoAssignAgent = (agentId: string) => {
    setAutoAssignAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const handleSaveAutoAssign = async () => {
    const poolIds = autoAssignAgentIds.filter((id) =>
      config.assignedAgentIds.includes(id)
    );

    setSavingAutoAssign(true);
    try {
      if (env.useMock) {
        updateSettings(inboxId, {
          autoAssignEnabled,
          autoAssignAgentIds: poolIds,
        });
      } else {
        const updated = await inboxApiService.updateSettings(inboxId, {
          autoAssignEnabled,
          autoAssignAgentIds: poolIds,
        });
        updateSettings(inboxId, {
          autoAssignEnabled: updated.autoAssignEnabled,
          autoAssignAgentIds: updated.autoAssignAgentIds,
        });
      }
      showToast("Asignación automática guardada");
    } catch {
      showToast("No se pudo guardar la asignación automática");
    } finally {
      setSavingAutoAssign(false);
    }
  };

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

  const handleUpdateLabel = async (
    labelId: string,
    name: string,
    color: string
  ) => {
    const ok = await updateLabel(inboxId, labelId, name, color);
    if (!ok) return false;

    const updated = getLabelById(labelId);
    if (updated) {
      syncLabelInConversations(updated);
    }
    showToast("Etiqueta actualizada");
    return true;
  };

  const openCreateLabelModal = () => {
    setLabelPendingEdit(null);
    setLabelModalOpen(true);
  };

  const openEditLabelModal = (label: Label) => {
    setLabelPendingEdit(label);
    setLabelModalOpen(true);
  };

  const closeLabelModal = () => {
    setLabelModalOpen(false);
    setLabelPendingEdit(null);
  };

  const handleConfirmDeleteLabel = async () => {
    const label = labelPendingDelete;
    if (!label) return;

    setDeletingLabelId(label.id);
    try {
      const ok = await deleteLabel(inboxId, label.id);
      if (!ok) {
        showToast("No se pudo eliminar la etiqueta");
        return;
      }
      removeLabelFromAllConversations(label.id);
      setLabelPendingDelete(null);
      showToast("Etiqueta eliminada");
    } finally {
      setDeletingLabelId(null);
    }
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
        <CopyableValueRow
          label="Inbox ID"
          value={inbox.id}
          onCopy={() => {
            void navigator.clipboard.writeText(inbox.id);
            showToast("Inbox ID copiado");
          }}
          hint="Úsalo en n8n como inboxId del path (/api/v1/inboxes/{id}/...)"
        />
        <SettingsField label="Identificador" value={config.detail} mono />
        <SettingsField label="Estado" value={<InboxStatusBadge status={config.status} />} />
        {config.description && <SettingsField label="Descripción" value={config.description} />}
      </SettingsSection>

      <SettingsSection
        title="Bot"
        description="Tras un mensaje del agente, el bot no responde durante este tiempo"
        action={
          <button
            type="button"
            onClick={() => void handleSaveBotPause()}
            disabled={savingBot}
            className="h-8 px-3 text-xs font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors disabled:opacity-50"
          >
            {savingBot ? "Guardando…" : "Guardar"}
          </button>
        }
      >
        <label className="flex items-start justify-between gap-4 py-2.5">
          <span className="text-[13px] text-[var(--color-text-muted)] shrink-0 pt-2">
            Minutos de pausa
          </span>
          <div className="flex flex-col items-end gap-1 min-w-0">
            <input
              type="number"
              min={BOT_PAUSE_MIN}
              max={BOT_PAUSE_MAX}
              step={1}
              value={botPauseMinutes}
              onChange={(e) => setBotPauseMinutes(e.target.value)}
              className="w-28 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)] text-right tabular-nums"
            />
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Entre {BOT_PAUSE_MIN} y {BOT_PAUSE_MAX} minutos
            </span>
          </div>
        </label>
      </SettingsSection>

      <SettingsSection
        title={`Etiquetas (${inboxLabels.length})`}
        description="Etiquetas disponibles solo en esta bandeja"
        action={
          <button
            type="button"
            onClick={openCreateLabelModal}
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
              <LabelChip
                key={label.id}
                label={label}
                accentColor={labelAccentById[label.id]}
                deleting={deletingLabelId === label.id}
                onClick={() => openEditLabelModal(label)}
                onDelete={() => setLabelPendingDelete(label)}
              />
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

      <SettingsSection
        title="Asignación automática"
        description="Al llegar un chat nuevo o reabrirse uno resuelto, se asigna al agente del pool con menos conversaciones abiertas"
        action={
          <button
            type="button"
            onClick={() => void handleSaveAutoAssign()}
            disabled={savingAutoAssign}
            className="h-8 px-3 text-xs font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors disabled:opacity-50"
          >
            {savingAutoAssign ? "Guardando…" : "Guardar"}
          </button>
        }
      >
        <SettingsToggle
          checked={autoAssignEnabled}
          onChange={setAutoAssignEnabled}
          label="Activar autoasignación"
          description="Solo aplica a mensajes entrantes. El acceso a la bandeja no cambia."
        />

        {assignedAgents.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] pt-2">
            Asigna agentes a esta bandeja en Ajustes → Agentes para armar el pool.
          </p>
        ) : (
          <div className="pt-2 space-y-2">
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Participan en el reparto (puedes excluir admins o agentes de vacaciones)
            </p>
            {assignedAgents.map((agent) => {
              const inPool = autoAssignAgentIds.includes(agent.id);
              const inactive = agent.active === false;
              return (
                <label
                  key={agent.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)] truncate">
                      {agent.name}
                      {inactive ? (
                        <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">
                          (inactivo)
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {getRoleName(agent.roleId)}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={inPool}
                    onChange={() => toggleAutoAssignAgent(agent.id)}
                    className="h-4 w-4 rounded border-[var(--color-border-primary)] accent-[var(--color-brand)]"
                  />
                </label>
              );
            })}
          </div>
        )}
      </SettingsSection>

      <section ref={integrationRef}>
        <SettingsSection
          title="Integración"
          description="Conexión del canal con el proveedor externo"
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
        onClose={closeLabelModal}
        onCreate={handleCreateLabel}
        onUpdate={handleUpdateLabel}
        initialLabel={labelPendingEdit}
        initialColorOverride={
          labelPendingEdit
            ? labelAccentById[labelPendingEdit.id]
            : undefined
        }
      />

      <SettingsModal
        open={labelPendingDelete !== null}
        onClose={() => {
          if (deletingLabelId) return;
          setLabelPendingDelete(null);
        }}
        title="Eliminar etiqueta"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setLabelPendingDelete(null)}
              disabled={deletingLabelId !== null}
              className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmDeleteLabel()}
              disabled={deletingLabelId !== null}
              className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white transition-colors disabled:opacity-60"
            >
              {deletingLabelId ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          {labelPendingDelete
            ? `¿Eliminar la etiqueta “${labelPendingDelete.name}”? Se quitará de todas las conversaciones de esta bandeja.`
            : null}
        </p>
      </SettingsModal>
    </div>
  );
}
