import { useMemo, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { WhatsAppTemplateList } from "@/components/chat/WhatsAppTemplateList";
import { WhatsAppTemplateParamForm } from "@/components/chat/WhatsAppTemplateParamForm";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { WHATSAPP_WINDOW_DOCS_URL } from "@/lib/whatsappReplyWindow";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import type { WhatsAppTemplate } from "@/types/whatsappTemplate";
import { buildTemplatePreviewContent } from "@/types/whatsappTemplate";

interface WhatsAppReplyWindowBannerProps {
  conversationId: string;
}

export function WhatsAppReplyWindowBanner({ conversationId }: WhatsAppReplyWindowBannerProps) {
  const conversations = useConversationStore((s) => s.conversations);
  const sendTemplateMessage = useConversationStore((s) => s.sendTemplateMessage);
  const showToast = useUIStore((s) => s.showToast);

  const inboxId = useMemo(
    () => conversations.find((item) => item.id === conversationId)?.inboxId ?? null,
    [conversations, conversationId]
  );

  const { templates, loading, error } = useWhatsAppTemplates(inboxId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState<WhatsAppTemplate | null>(null);
  const [bodyParameters, setBodyParameters] = useState<string[]>([]);
  const [headerParameters, setHeaderParameters] = useState<string[]>([]);
  const [buttonUrlParameters, setButtonUrlParameters] = useState<Record<number, string>>({});

  const resetDraft = () => {
    setDraftTemplate(null);
    setBodyParameters([]);
    setHeaderParameters([]);
    setButtonUrlParameters({});
  };

  const sendTemplate = async (
    template: WhatsAppTemplate,
    params: {
      bodyParameters: string[];
      headerParameters: string[];
      buttonUrlParameters: Record<number, string>;
    }
  ) => {
    setSending(true);
    try {
      const content = buildTemplatePreviewContent(
        template,
        params.bodyParameters,
        params.headerParameters
      );

      const ok = await sendTemplateMessage(conversationId, {
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
        showToast("Meta rechazó la plantilla. El aviso permanece activo.");
        return;
      }

      setPickerOpen(false);
      setSearch("");
      resetDraft();
      showToast("Plantilla enviada correctamente");
    } finally {
      setSending(false);
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

  return (
    <div className="border-t border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]">
      <div
        className="mx-3 my-3 rounded-lg px-4 py-3 text-center text-sm leading-relaxed"
        style={{ backgroundColor: "#3d1b1e", color: "#f5f5f5" }}
      >
        <span>No puede responder debido a la </span>
        <a
          href={WHATSAPP_WINDOW_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-90"
        >
          Restricción de la ventana de mensajes de 24 horas
        </a>
      </div>

      <div className="px-3 pb-3 relative">
        <button
          type="button"
          onClick={() => {
            setPickerOpen((prev) => !prev);
            resetDraft();
          }}
          disabled={sending}
          className={cn(
            "w-full h-10 flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
            "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10",
            sending && "opacity-60 cursor-not-allowed"
          )}
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MessageSquare className="w-4 h-4" />
          )}
          {sending ? "Enviando plantilla…" : "Enviar plantilla de WhatsApp"}
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 z-30 bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-xl overflow-hidden animate-fade-in">
            {!draftTemplate && (
              <div className="px-4 py-2.5 border-b border-[var(--color-border-primary)]">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  Plantillas de WhatsApp
                </p>
              </div>
            )}

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
                  setHeaderParameters((prev) => prev.map((item, i) => (i === index ? value : item)))
                }
                onButtonChange={(index, value) =>
                  setButtonUrlParameters((prev) => ({ ...prev, [index]: value }))
                }
                onCancel={resetDraft}
                onConfirm={() =>
                  void sendTemplate(draftTemplate, {
                    bodyParameters,
                    headerParameters,
                    buttonUrlParameters,
                  })
                }
                confirmLabel={sending ? "Enviando…" : "Enviar"}
                busy={sending}
              />
            ) : (
              <WhatsAppTemplateList
                templates={templates}
                loading={loading}
                error={error}
                search={search}
                onSearchChange={setSearch}
                onSelect={handleSelectTemplate}
                disabled={sending}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
