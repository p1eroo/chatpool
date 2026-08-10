import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MessageCircle, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { WhatsAppTemplateList } from "@/components/chat/WhatsAppTemplateList";
import { WhatsAppTemplateParamForm } from "@/components/chat/WhatsAppTemplateParamForm";
import { contactKeys } from "@/hooks/useContacts";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { conversationApiService } from "@/services/conversationApiService";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import {
  formatLocalWhatsAppPhoneDisplay,
  getWhatsAppPhoneValidationError,
  sanitizeLocalWhatsAppPhone,
  toWhatsAppApiPhone,
  whatsappPhonePrefixLabel,
} from "@/lib/whatsappPhone";
import type { WhatsAppTemplate } from "@/types/whatsappTemplate";
import { buildTemplatePreviewContent } from "@/types/whatsappTemplate";
import type { Contact, Inbox } from "@/types";
import { ApiError } from "@/api/errors";

interface NewOutboundMessageModalProps {
  open: boolean;
  onClose: () => void;
  inboxes: Inbox[];
  defaultInboxId: string | null;
  onStarted: (params: { contact: Contact; conversationId: string }) => void;
}

export function NewOutboundMessageModal({
  open,
  onClose,
  inboxes,
  defaultInboxId,
  onStarted,
}: NewOutboundMessageModalProps) {
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const applyRealtimeConversation = useConversationStore((s) => s.applyRealtimeConversation);
  const sendTemplateMessage = useConversationStore((s) => s.sendTemplateMessage);

  const whatsappInboxes = useMemo(
    () => inboxes.filter((inbox) => inbox.channelType === "whatsapp"),
    [inboxes]
  );

  const [inboxId, setInboxId] = useState(defaultInboxId ?? whatsappInboxes[0]?.id ?? "");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"details" | "template">("details");
  const [busy, setBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [draftTemplate, setDraftTemplate] = useState<WhatsAppTemplate | null>(null);
  const [bodyParameters, setBodyParameters] = useState<string[]>([]);
  const [headerParameters, setHeaderParameters] = useState<string[]>([]);
  const [buttonUrlParameters, setButtonUrlParameters] = useState<Record<number, string>>({});

  const { templates, loading, error } = useWhatsAppTemplates(
    step === "template" ? inboxId : null
  );

  useEffect(() => {
    if (!open) return;
    const preferred =
      (defaultInboxId &&
        whatsappInboxes.some((inbox) => inbox.id === defaultInboxId) &&
        defaultInboxId) ||
      whatsappInboxes[0]?.id ||
      "";
    setInboxId(preferred);
    setPhoneDigits("");
    setName("");
    setStep("details");
    setBusy(false);
    setPhoneError(null);
    setSearch("");
    setDraftTemplate(null);
    setBodyParameters([]);
    setHeaderParameters([]);
    setButtonUrlParameters({});
  }, [open, defaultInboxId, whatsappInboxes]);

  if (!open) return null;

  const selectedInbox = whatsappInboxes.find((inbox) => inbox.id === inboxId) ?? null;

  const goToTemplates = () => {
    const validation = getWhatsAppPhoneValidationError(phoneDigits);
    if (validation) {
      setPhoneError(validation);
      return;
    }
    if (!inboxId) {
      showToast("Selecciona una bandeja de WhatsApp");
      return;
    }
    setPhoneError(null);
    setStep("template");
  };

  const sendWithTemplate = async (template: WhatsAppTemplate, params: {
    bodyParameters: string[];
    headerParameters: string[];
    buttonUrlParameters: Record<number, string>;
  }) => {
    const apiPhone = toWhatsAppApiPhone(phoneDigits);
    if (!apiPhone || !inboxId) return;

    setBusy(true);
    try {
      const started = await conversationApiService.startOutbound({
        inboxId,
        phone: apiPhone,
        name: name.trim() || undefined,
      });

      queryClient.setQueryData<Contact[]>(contactKeys.list(), (prev = []) => {
        const exists = prev.some((item) => item.id === started.contact.id);
        return exists
          ? prev.map((item) => (item.id === started.contact.id ? started.contact : item))
          : [...prev, started.contact].sort((a, b) => a.name.localeCompare(b.name));
      });

      applyRealtimeConversation(started.conversation);

      const content = buildTemplatePreviewContent(
        template,
        params.bodyParameters,
        params.headerParameters
      );

      const ok = await sendTemplateMessage(started.conversation.id, {
        templateId: template.id,
        templateName: template.name,
        language: template.language,
        content,
        bodyParameters: params.bodyParameters,
        headerParameters: params.headerParameters,
        buttonUrlParameters: template.buttonUrlParamIndexes.map((index) => ({
          index,
          text: params.buttonUrlParameters[index] ?? "",
        })),
      });

      if (!ok) {
        showToast("Se creó el contacto, pero Meta rechazó la plantilla");
        onStarted({ contact: started.contact, conversationId: started.conversation.id });
        onClose();
        return;
      }

      showToast("Mensaje enviado. Contacto agregado.");
      onStarted({ contact: started.contact, conversationId: started.conversation.id });
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo iniciar la conversación";
      showToast(message);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setDraftTemplate(template);
    setBodyParameters(Array.from({ length: template.bodyParamCount }, () => ""));
    setHeaderParameters(Array.from({ length: template.headerParamCount }, () => ""));
    setButtonUrlParameters(
      Object.fromEntries(template.buttonUrlParamIndexes.map((index) => [index, ""]))
    );
  };

  return createPortal(
    <div data-modal-overlay className="fixed inset-0 z-[180] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={() => {
          if (!busy) onClose();
        }}
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-primary)]">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Nuevo mensaje
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {step === "details"
                ? "Escribe un número que aún no tengas en contactos"
                : "El primer mensaje debe ser una plantilla de WhatsApp"}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "details" ? (
          <div className="p-5 space-y-4">
            {whatsappInboxes.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No tienes bandejas de WhatsApp disponibles.
              </p>
            ) : (
              <>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    Para
                  </label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] px-3 py-2.5 focus-within:border-[var(--color-brand)]">
                    <span className="text-sm text-[var(--color-text-muted)] shrink-0">
                      {whatsappPhonePrefixLabel()}
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoFocus
                      value={formatLocalWhatsAppPhoneDisplay(phoneDigits)}
                      onChange={(e) => {
                        setPhoneDigits(sanitizeLocalWhatsAppPhone(e.target.value));
                        setPhoneError(null);
                      }}
                      placeholder="987 654 321"
                      className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
                    />
                  </div>
                  {phoneError && (
                    <p className="mt-1.5 text-xs text-red-400">{phoneError}</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    Nombre{" "}
                    <span className="font-normal normal-case tracking-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="mt-1.5 w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand)] placeholder:text-[var(--color-text-muted)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    Vía
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {whatsappInboxes.map((inbox) => (
                      <button
                        key={inbox.id}
                        type="button"
                        onClick={() => setInboxId(inbox.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                          inboxId === inbox.id
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                            : "border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                        )}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {inbox.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3 text-xs rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={whatsappInboxes.length === 0}
                onClick={goToTemplates}
                className="h-9 px-3 text-xs rounded-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col max-h-[min(75vh,560px)]">
            <div className="px-5 py-3 border-b border-[var(--color-border-primary)] space-y-1.5 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--color-text-muted)]">Para</span>
                <span className="rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] px-2 py-1 text-[var(--color-text-primary)]">
                  {name.trim() || `${whatsappPhonePrefixLabel()} ${formatLocalWhatsAppPhoneDisplay(phoneDigits)}`}
                  {name.trim() ? (
                    <span className="text-[var(--color-text-muted)]">
                      {" "}
                      ({whatsappPhonePrefixLabel()} {formatLocalWhatsAppPhoneDisplay(phoneDigits)})
                    </span>
                  ) : null}
                </span>
              </div>
              {selectedInbox && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--color-text-muted)]">Vía</span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] px-2 py-1 text-[var(--color-text-primary)]">
                    <MessageCircle className="w-3 h-3 text-emerald-400" />
                    {selectedInbox.name}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {draftTemplate ? (
                <WhatsAppTemplateParamForm
                  template={draftTemplate}
                  bodyParameters={bodyParameters}
                  headerParameters={headerParameters}
                  buttonUrlParameters={buttonUrlParameters}
                  onBodyChange={(index, value) =>
                    setBodyParameters((prev) => prev.map((item, i) => (i === index ? value : item)))
                  }
                  onHeaderChange={(index, value) =>
                    setHeaderParameters((prev) =>
                      prev.map((item, i) => (i === index ? value : item))
                    )
                  }
                  onButtonChange={(index, value) =>
                    setButtonUrlParameters((prev) => ({ ...prev, [index]: value }))
                  }
                  onCancel={() => setDraftTemplate(null)}
                  onConfirm={() =>
                    void sendWithTemplate(draftTemplate, {
                      bodyParameters,
                      headerParameters,
                      buttonUrlParameters,
                    })
                  }
                  confirmLabel={busy ? "Enviando…" : "Enviar"}
                  busy={busy}
                />
              ) : (
                <WhatsAppTemplateList
                  templates={templates}
                  loading={loading}
                  error={error}
                  search={search}
                  onSearchChange={setSearch}
                  onSelect={handleSelectTemplate}
                  disabled={busy}
                />
              )}
            </div>

            {!draftTemplate && (
              <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--color-border-primary)] shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep("details")}
                  className="h-9 px-3 text-xs rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                >
                  Volver
                </button>
                {busy && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando…
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
