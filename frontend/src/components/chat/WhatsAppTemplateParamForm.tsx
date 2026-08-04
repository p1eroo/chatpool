import type { WhatsAppTemplate } from "@/types/whatsappTemplate";
import { buildTemplatePreviewContent } from "@/types/whatsappTemplate";

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
  confirmLabel = "Usar plantilla",
  busy,
}: WhatsAppTemplateParamFormProps) {
  const preview = buildTemplatePreviewContent(template, bodyParameters, headerParameters);

  const canConfirm =
    !busy &&
    template.supported &&
    headerParameters.every((value) => value.trim()) &&
    bodyParameters.every((value) => value.trim()) &&
    template.buttonUrlParamIndexes.every((index) => buttonUrlParameters[index]?.trim());

  return (
    <div className="p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{template.name}</p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          Idioma: {template.language}
        </p>
      </div>

      <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
        {preview}
      </p>

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

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-8 px-3 text-xs rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
        >
          Cancelar
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
