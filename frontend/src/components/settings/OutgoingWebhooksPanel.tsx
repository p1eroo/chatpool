import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Trash2, Webhook } from "lucide-react";
import { SettingsModal } from "@/components/settings/SettingsModal";
import {
  useCreateOutgoingWebhook,
  useDeleteOutgoingWebhook,
  useOutgoingWebhooks,
  useUpdateOutgoingWebhook,
} from "@/hooks/useOutgoingWebhooks";
import { OUTGOING_WEBHOOK_EVENT_OPTIONS } from "@/services/outgoingWebhookService";
import { useInboxStore } from "@/store/inboxStore";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import type { OutgoingWebhookDto, OutgoingWebhookEvent } from "@/types/api";

type EditorMode = "create" | "edit";

const DEFAULT_EVENTS: OutgoingWebhookEvent[] = [
  "message_created",
  "conversation_status_changed",
];

export function OutgoingWebhooksPanel() {
  const showToast = useUIStore((s) => s.showToast);
  const inboxes = useInboxStore((s) => s.inboxes);
  const getInboxById = useInboxStore((s) => s.getInboxById);

  const { data: webhooks = [], isLoading } = useOutgoingWebhooks();
  const createMutation = useCreateOutgoingWebhook();
  const updateMutation = useUpdateOutgoingWebhook();
  const deleteMutation = useDeleteOutgoingWebhook();

  const [listOpen, setListOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editing, setEditing] = useState<OutgoingWebhookDto | null>(null);

  const [inboxId, setInboxId] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [subscriptions, setSubscriptions] = useState<OutgoingWebhookEvent[]>(DEFAULT_EVENTS);

  const activeCount = useMemo(
    () => webhooks.filter((item) => item.enabled).length,
    [webhooks]
  );

  const resetEditor = () => {
    setInboxId(inboxes[0]?.id ?? "");
    setName("");
    setUrl("");
    setEnabled(true);
    setSubscriptions(DEFAULT_EVENTS);
    setEditing(null);
  };

  const openCreate = () => {
    resetEditor();
    setEditorMode("create");
    setEditorOpen(true);
  };

  const openEdit = (webhook: OutgoingWebhookDto) => {
    setEditing(webhook);
    setEditorMode("edit");
    setInboxId(webhook.inboxId);
    setName(webhook.name ?? "");
    setUrl(webhook.url);
    setEnabled(webhook.enabled);
    setSubscriptions(
      webhook.subscriptions.filter((event): event is OutgoingWebhookEvent =>
        OUTGOING_WEBHOOK_EVENT_OPTIONS.some((option) => option.id === event)
      )
    );
    setEditorOpen(true);
  };

  const toggleSubscription = (event: OutgoingWebhookEvent) => {
    setSubscriptions((current) =>
      current.includes(event)
        ? current.filter((item) => item !== event)
        : [...current, event]
    );
  };

  const busy =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleSave = async () => {
    if (editorMode === "create" && !inboxId) {
      showToast("Selecciona una bandeja");
      return;
    }
    if (!url.trim()) {
      showToast("La URL es obligatoria");
      return;
    }
    if (subscriptions.length === 0) {
      showToast("Selecciona al menos un evento");
      return;
    }

    try {
      if (editorMode === "create") {
        await createMutation.mutateAsync({
          inboxId,
          url: url.trim(),
          name: name.trim() || null,
          subscriptions,
          enabled,
        });
        showToast("Webhook creado");
      } else if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          body: {
            url: url.trim(),
            name: name.trim() || null,
            subscriptions,
            enabled,
          },
        });
        showToast("Webhook actualizado");
      }
      setEditorOpen(false);
      resetEditor();
    } catch {
      showToast("No se pudo guardar el webhook");
    }
  };

  const handleDelete = async (webhook: OutgoingWebhookDto) => {
    const ok = window.confirm(`¿Eliminar el webhook${webhook.name ? ` “${webhook.name}”` : ""}?`);
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(webhook.id);
      showToast("Webhook eliminado");
      if (editing?.id === webhook.id) {
        setEditorOpen(false);
        resetEditor();
      }
    } catch {
      showToast("No se pudo eliminar el webhook");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setListOpen(true)}
        className="w-full text-left rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 hover:border-[var(--color-brand)]/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand)] flex items-center justify-center shrink-0">
              <Webhook className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Webhook
                </h3>
                {activeCount > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0" />
                ) : null}
              </div>
              <p className="text-[12px] text-[var(--color-text-secondary)] mt-1">
                Envía eventos de una bandeja a una URL externa (n8n, Zapier, etc.) con POST JSON.
                La configuración de WhatsApp / Meta se hace en Bandejas.
              </p>
            </div>
          </div>
          <span className="text-[12px] font-medium text-[var(--color-brand)] shrink-0 pt-0.5">
            Configurar
          </span>
        </div>
      </button>

      <SettingsModal
        open={listOpen}
        onClose={() => setListOpen(false)}
        title="Webhooks"
        description="URLs externas que reciben eventos de la bandeja que indiques"
        wide
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openCreate}
              disabled={inboxes.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-brand)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Añadir webhook
            </button>
          </div>
        }
      >
        {inboxes.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Primero crea una bandeja en Ajustes → Bandejas.
          </p>
        ) : isLoading ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">Cargando…</p>
        ) : webhooks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border-primary)] px-4 py-8 text-center">
            <p className="text-sm text-[var(--color-text-primary)] font-medium">
              Sin webhooks configurados
            </p>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
              Añade la URL de producción de n8n y elige la bandeja cuyos eventos quieres recibir.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((webhook) => {
              const inboxName = getInboxById(webhook.inboxId)?.name ?? "Bandeja";
              return (
                <div
                  key={webhook.id}
                  className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openEdit(webhook)}
                      className="min-w-0 text-left flex-1"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                          {webhook.name || "Webhook"}
                        </p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                          {inboxName}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            webhook.enabled
                              ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                              : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
                          )}
                        >
                          {webhook.enabled ? "Activo" : "Pausado"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                        {webhook.url}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">
                        {webhook.subscriptions.join(", ")}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(webhook)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-red-400 transition-colors shrink-0"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsModal>

      <SettingsModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editorMode === "create" ? "Añadir webhook" : "Editar webhook"}
        description="Chatpool enviará un POST JSON a esta URL cuando ocurran los eventos de la bandeja seleccionada"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="px-3 py-2 rounded-lg text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              className="px-3 py-2 rounded-lg bg-[var(--color-brand)] text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
            >
              {editorMode === "create" ? "Crear webhook" : "Guardar"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[12px] text-[var(--color-text-muted)]">Bandeja *</span>
            {editorMode === "create" ? (
              <select
                value={inboxId}
                onChange={(e) => setInboxId(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand)]"
              >
                {inboxes.length === 0 ? <option value="">Sin bandejas</option> : null}
                {inboxes.map((inbox) => (
                  <option key={inbox.id} value={inbox.id}>
                    {inbox.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[13px] text-[var(--color-text-primary)] px-1 py-2">
                {getInboxById(inboxId)?.name ?? inboxId}
              </p>
            )}
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] text-[var(--color-text-muted)]">Nombre (opcional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="n8n producción"
              className="w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand)]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] text-[var(--color-text-muted)]">URL *</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://n8n.ejemplo.com/webhook/..."
              className="w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand)]"
            />
          </label>

          <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-[var(--color-border-primary)]"
            />
            Activo
          </label>

          <div>
            <p className="text-[12px] text-[var(--color-text-muted)] mb-2">Eventos</p>
            <div className="space-y-2">
              {OUTGOING_WEBHOOK_EVENT_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border-primary)] px-3 py-2.5 cursor-pointer hover:bg-[var(--color-bg-tertiary)]/50"
                >
                  <input
                    type="checkbox"
                    checked={subscriptions.includes(option.id)}
                    onChange={() => toggleSubscription(option.id)}
                    className="mt-0.5 rounded border-[var(--color-border-primary)]"
                  />
                  <span>
                    <span className="block text-[13px] font-mono text-[var(--color-text-primary)]">
                      {option.label}
                    </span>
                    <span className="block text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SettingsModal>
    </>
  );
}
