import type { WhatsAppTemplate } from "@/types/whatsappTemplate";
import { buildTemplatePreviewContent, templateNeedsParams } from "@/types/whatsappTemplate";
import { WhatsAppFormattedText } from "@/lib/whatsappFormatting";

interface WhatsAppTemplateParamFormProps {
  template: WhatsAppTemplate;
  bodyParameters: string[];
  headerParameters: string[];
  buttonUrlParameters: Record<number, string>;
  onBodyChange: (index: number, value: string) => void;
  onHeaderChange: (index: number, value: string) => void;
  onButtonChange: (index: number, value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  busy?: boolean;
}

export function WhatsAppTemplateParamForm({
  template,
  bodyParameters,
  headerParameters,
  buttonUrlParameters,
  onBodyChange,
  onHeaderChange,
  onButtonChange,
  onCancel,
  onConfirm,
  confirmLabel = "Enviar",
  busy,
}: WhatsAppTemplateParamFormProps) {
  const preview = buildTemplatePreviewContent(template, bodyParameters, headerParameters);
  const needsParams = templateNeedsParams(template);

  const canConfirm =
    !busy &&
    template.supported &&
    headerParameters.every((value) => value.trim()) &&
    bodyParameters.every((value) => value.trim()) &&
    template.buttonUrlParamIndexes.every((index) => buttonUrlParameters[index]?.trim());

  return (
    <div className="flex flex-col max-h-[min(70vh,520px)]">
      <div className="px-4 py-2.5 border-b border-[var(--color-border-primary)] shrink-0">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Vista previa
        </p>
        <div className="flex items-baseline gap-2 mt-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {template.name}
          </p>
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] shrink-0">
            {template.language}
          </span>
        </div>
        {template.category && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {template.category}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="rounded-2xl bg-[#005c4b]/25 border border-emerald-500/20 px-3.5 py-3">
          <p className="text-[11px] font-medium text-emerald-400/90 mb-2">WhatsApp</p>
          <WhatsAppFormattedText
            as="div"
            text={preview}
            className="text-sm text-[var(--color-text-primary)] leading-relaxed"
          />
          {!preview.trim() && (
            <p className="text-xs text-[var(--color-text-muted)] italic">Sin contenido de texto</p>
          )}
        </div>

        {needsParams && (
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Completa las variables para ver el mensaje final.
          </p>
        )}

        {template.headerParamCount > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Encabezado
            </p>
            {Array.from({ length: template.headerParamCount }, (_, index) => (
              <input
                key={`header-${index}`}
                type="text"
                value={headerParameters[index] ?? ""}
                onChange={(e) => onHeaderChange(index, e.target.value)}
                placeholder={`Variable {{${index + 1}}}`}
                className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)]"
              />
            ))}
          </div>
        )}

        {template.bodyParamCount > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Cuerpo
            </p>
            {Array.from({ length: template.bodyParamCount }, (_, index) => (
              <input
                key={`body-${index}`}
                type="text"
                value={bodyParameters[index] ?? ""}
                onChange={(e) => onBodyChange(index, e.target.value)}
                placeholder={`Variable {{${index + 1}}}`}
                className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)]"
              />
            ))}
          </div>
        )}

        {template.buttonUrlParamIndexes.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Botones URL
            </p>
            {template.buttonUrlParamIndexes.map((index) => (
              <input
                key={`button-${index}`}
                type="text"
                value={buttonUrlParameters[index] ?? ""}
                onChange={(e) => onButtonChange(index, e.target.value)}
                placeholder={`Variable botón #${index + 1}`}
                className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)]"
              />
            ))}
          </div>
        )}

        {!template.supported && template.unsupportedReason && (
          <p className="text-xs text-amber-400">{template.unsupportedReason}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-3 py-2.5 border-t border-[var(--color-border-primary)] shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-8 px-3 text-xs rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="h-8 px-3 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
