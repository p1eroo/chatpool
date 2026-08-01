import { useMemo, useState } from "react";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { whatsappTemplates } from "@/data/mock";
import { WHATSAPP_WINDOW_DOCS_URL } from "@/lib/whatsappReplyWindow";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";

interface WhatsAppReplyWindowBannerProps {
  conversationId: string;
}

export function WhatsAppReplyWindowBanner({ conversationId }: WhatsAppReplyWindowBannerProps) {
  const sendTemplateMessage = useConversationStore((s) => s.sendTemplateMessage);
  const showToast = useUIStore((s) => s.showToast);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sendingTemplateId, setSendingTemplateId] = useState<string | null>(null);

  const filteredTemplates = useMemo(
    () =>
      whatsappTemplates.filter(
        (template) =>
          template.name.toLowerCase().includes(search.toLowerCase()) ||
          template.preview.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  const handleSendTemplate = async (templateId: string) => {
    const template = whatsappTemplates.find((item) => item.id === templateId);
    if (!template || sendingTemplateId) return;

    setSendingTemplateId(templateId);
    try {
      const ok = await sendTemplateMessage(conversationId, {
        templateId: template.id,
        templateName: template.name,
        content: template.preview,
      });

      if (!ok) {
        showToast("Meta rechazó la plantilla. El aviso permanece activo.");
        return;
      }

      setPickerOpen(false);
      setSearch("");
      showToast("Plantilla enviada correctamente");
    } finally {
      setSendingTemplateId(null);
    }
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
          onClick={() => setPickerOpen((prev) => !prev)}
          disabled={Boolean(sendingTemplateId)}
          className={cn(
            "w-full h-10 flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
            "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10",
            sendingTemplateId && "opacity-60 cursor-not-allowed"
          )}
        >
          {sendingTemplateId ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MessageSquare className="w-4 h-4" />
          )}
          {sendingTemplateId ? "Enviando plantilla…" : "Enviar plantilla de WhatsApp"}
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 z-30 bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-xl overflow-hidden animate-fade-in">
            <div className="px-4 py-2.5 border-b border-[var(--color-border-primary)]">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Plantillas de WhatsApp
              </p>
            </div>
            <div className="p-3 border-b border-[var(--color-border-primary)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Buscar plantillas"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg pl-9 pr-3 py-2.5 outline-none border border-transparent focus:border-[var(--color-brand)]"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto py-1.5">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  disabled={Boolean(sendingTemplateId)}
                  onClick={() => void handleSendTemplate(template.id)}
                  className="w-full px-4 py-2.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    {template.name}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                    {template.preview}
                  </p>
                </button>
              ))}
              {filteredTemplates.length === 0 && (
                <p className="px-4 py-6 text-sm text-center text-[var(--color-text-muted)]">
                  Sin resultados
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
