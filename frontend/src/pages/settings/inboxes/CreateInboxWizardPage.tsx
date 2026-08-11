import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { env } from "@/config/env";
import {
  channelWizardOptions,
  getChannelOption,
  getProviderForChannel,
} from "@/lib/inboxUtils";
import { getImplementedChannelWizardOptions } from "@/lib/integrationProviders";
import { buildInboxWebhookUrl } from "@/lib/webhooks";
import { inboxApiService } from "@/services/inboxApiService";
import { useAuthStore } from "@/store/authStore";
import { useAgentStore } from "@/store/agentStore";
import { useRoleStore } from "@/store/roleStore";
import { useInboxStore } from "@/store/inboxStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { InboxWizardStepper } from "@/components/settings/inbox-wizard/InboxWizardStepper";
import { Avatar } from "@/components/ui/Avatar";
import { SecretInput } from "@/components/ui/SecretInput";
import { useUIStore } from "@/store/uiStore";
import type { ChannelType } from "@/types";

export function CreateInboxWizardPage() {
  const showToast = useUIStore((s) => s.showToast);
  const addInbox = useInboxStore((s) => s.addInbox);
  const setInboxes = useInboxStore((s) => s.setInboxes);
  const addSettings = useInboxSettingsStore((s) => s.addSettings);
  const setSettings = useInboxSettingsStore((s) => s.setSettings);
  const allAgents = useAgentStore((s) => s.agents);
  const currentAgentId = useAuthStore((s) => s.agentId);
  const agents = useMemo(
    () => allAgents.filter((agent) => agent.active !== false),
    [allAgents]
  );
  const getRoleName = useRoleStore((s) => s.getRoleName);

  const [step, setStep] = useState(1);
  const [channelType, setChannelType] = useState<ChannelType | null>(null);

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [description, setDescription] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [createdInboxId, setCreatedInboxId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (currentAgentId && selectedAgentIds.length === 0) {
      setSelectedAgentIds([currentAgentId]);
    }
  }, [currentAgentId, selectedAgentIds.length]);

  const channelMeta = useMemo(
    () => (channelType ? getChannelOption(channelType) : null),
    [channelType]
  );

  const availableChannelOptions = useMemo(
    () => getImplementedChannelWizardOptions(channelWizardOptions),
    []
  );

  const isConfigureFormValid = () => {
    if (!name.trim() || !detail.trim()) return false;
    if (channelType === "whatsapp") {
      return Boolean(phoneNumberId.trim() && businessAccountId.trim() && apiKey.trim());
    }
    return true;
  };

  const handleCreate = async () => {
    if (!channelType || selectedAgentIds.length === 0 || creating) return;

    const provider = getProviderForChannel(channelType);
    const trimmedName = name.trim();
    const trimmedDetail = detail.trim();

    if (!env.useMock) {
      setCreating(true);
      try {
        const { inbox, settings } = await inboxApiService.create({
          name: trimmedName,
          channelType,
          detail: trimmedDetail,
          providerResource: trimmedDetail,
          description: description.trim() || undefined,
          assignedAgentIds: selectedAgentIds,
          phoneNumberId: phoneNumberId.trim() || undefined,
          businessAccountId: businessAccountId.trim() || undefined,
          accessToken: apiKey.trim() || undefined,
        });

        setInboxes([inbox, ...useInboxStore.getState().inboxes]);
        setSettings([settings, ...useInboxSettingsStore.getState().settings]);
        setCreatedInboxId(inbox.id);
        setStep(4);
      } catch {
        showToast("No se pudo crear la bandeja. Revisa los datos e intenta de nuevo.");
      } finally {
        setCreating(false);
      }
      return;
    }

    const inboxId = addInbox({ name: trimmedName, channelType });

    addSettings({
      inboxId,
      detail: trimmedDetail,
      status: provider === "meta" ? "pending" : "active",
      provider,
      providerResource: trimmedDetail,
      webhookUrl: provider === "meta" ? buildInboxWebhookUrl("meta", inboxId) : undefined,
      assignedAgentIds: selectedAgentIds,
      autoAssignAgentIds: selectedAgentIds,
      autoAssignEnabled: false,
      description: description.trim() || undefined,
      whatsappProvider: channelType === "whatsapp" ? "meta-cloud" : undefined,
      phoneNumberId: phoneNumberId.trim() || undefined,
      businessAccountId: businessAccountId.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      botPauseMinutes: 15,
    });

    setCreatedInboxId(inboxId);
    setStep(4);
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  return (
    <div className="space-y-4">
      <Link
        to="/settings/inboxes"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Bandejas
      </Link>

      <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-8 items-start">
        <InboxWizardStepper currentStep={step} />

        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl overflow-hidden min-h-[420px] flex flex-col">
          <div className="flex-1 p-6">
            {step === 1 && (
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                  Elija un canal
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-xl">
                  Elige el canal que quieres conectar. Solo aparecen integraciones ya disponibles
                  en tu instancia.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableChannelOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = channelType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setChannelType(option.value)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-5 rounded-xl border text-center transition-colors min-h-[120px]",
                          selected
                            ? "border-[var(--color-brand)] bg-[var(--color-brand-bg)]"
                            : "border-[var(--color-border-primary)] hover:bg-[var(--color-bg-hover)]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-7 h-7",
                            selected ? "text-[var(--color-brand)]" : "text-[var(--color-text-secondary)]"
                          )}
                        />
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {option.label}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && channelMeta && (
              <div className="max-w-xl">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                  {channelType === "whatsapp"
                    ? "Configura tu canal de WhatsApp"
                    : `Configura ${channelMeta.label}`}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                  {channelType === "whatsapp"
                    ? "Conecta con WhatsApp Cloud API usando tus credenciales de Meta."
                    : "Completa los datos de conexión para esta bandeja."}
                </p>
                <div className="space-y-4">
                  <Field label="Nombre de la bandeja de entrada" value={name} onChange={setName} />
                  <Field
                    label={channelMeta.detailLabel}
                    value={detail}
                    onChange={setDetail}
                    placeholder={channelMeta.detailPlaceholder}
                  />
                  {channelType === "whatsapp" && (
                    <>
                      <Field
                        label="ID de número de teléfono"
                        value={phoneNumberId}
                        onChange={setPhoneNumberId}
                        placeholder="Desde el panel de desarrolladores de Meta"
                      />
                      <Field
                        label="ID de cuenta de negocio"
                        value={businessAccountId}
                        onChange={setBusinessAccountId}
                      />
                      <Field
                        label="Clave de API"
                        value={apiKey}
                        onChange={setApiKey}
                        secret
                      />
                    </>
                  )}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--color-text-muted)] mb-1.5">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2.5 outline-none border border-transparent focus:border-[var(--color-brand)] resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="max-w-xl">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                  Añadir agentes
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                  Selecciona quién podrá ver y responder conversaciones en esta bandeja.
                </p>
                <div className="space-y-2">
                  {agents.map((agent) => {
                    const selected = selectedAgentIds.includes(agent.id);
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => toggleAgent(agent.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left",
                          selected
                            ? "border-[var(--color-brand)] bg-[var(--color-brand-bg)]"
                            : "border-[var(--color-border-primary)] hover:bg-[var(--color-bg-hover)]"
                        )}
                      >
                        <Avatar name={agent.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{agent.name}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">{getRoleName(agent.roleId)}</p>
                        </div>
                        {selected && <Check className="w-4 h-4 text-[var(--color-brand)] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col items-center justify-center text-center py-8 max-w-md mx-auto">
                <span className="w-14 h-14 rounded-full bg-[var(--color-brand-bg)] text-[var(--color-brand)] flex items-center justify-center mb-4">
                  <Check className="w-7 h-7" />
                </span>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                  ¡Bandeja creada!
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                  Ya puedes recibir conversaciones en <strong>{name}</strong>.
                  {channelType && getProviderForChannel(channelType) === "meta"
                    ? " Completa la verificación Meta en esta bandeja si quedó pendiente."
                    : null}
                </p>
                <div className="flex gap-2">
                  <Link
                    to="/settings/inboxes"
                    className="h-9 px-4 text-sm rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors inline-flex items-center"
                  >
                    Ver bandejas
                  </Link>
                  {createdInboxId && (
                    <Link
                      to={`/settings/inboxes/${createdInboxId}`}
                      className="h-9 px-4 text-sm font-medium rounded-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] transition-colors inline-flex items-center"
                    >
                      Configurar bandeja
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {step < 4 && (
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]/30">
              <button
                type="button"
                onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                disabled={step === 1}
                className={cn(
                  "h-9 px-4 text-sm rounded-lg transition-colors",
                  step === 1
                    ? "opacity-0 pointer-events-none"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                )}
              >
                Atrás
              </button>

              <button
                type="button"
                disabled={
                  creating ||
                  (step === 1 && !channelType) ||
                  (step === 2 && !isConfigureFormValid()) ||
                  (step === 3 && selectedAgentIds.length === 0)
                }
                onClick={() => {
                  if (step === 1 && channelType) {
                    setStep(2);
                    return;
                  }
                  if (step === 2) {
                    setStep(3);
                    return;
                  }
                  if (step === 3) {
                    void handleCreate();
                  }
                }}
                className={cn(
                  "h-9 px-5 text-sm font-medium rounded-lg bg-[var(--color-brand)] text-white transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:bg-[var(--color-brand-light)]"
                )}
              >
                {step === 3 ? (creating ? "Creando…" : "Crear bandeja") : "Siguiente"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  secret = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  secret?: boolean;
}) {
  const inputClass =
    "w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2.5 outline-none border border-transparent focus:border-[var(--color-brand)]";

  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--color-text-muted)] mb-1.5">
        {label}
      </label>
      {secret ? (
        <SecretInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={inputClass}
          revealLabel="Mostrar clave de API"
          hideLabel="Ocultar clave de API"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </div>
  );
}
