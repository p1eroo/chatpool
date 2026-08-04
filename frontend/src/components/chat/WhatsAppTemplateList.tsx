import { Loader2, Search } from "lucide-react";
import type { WhatsAppTemplate } from "@/types/whatsappTemplate";

interface WhatsAppTemplateListProps {
  templates: WhatsAppTemplate[];
  loading?: boolean;
  error?: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (template: WhatsAppTemplate) => void;
  disabled?: boolean;
  emptyLabel?: string;
}

export function WhatsAppTemplateList({
  templates,
  loading,
  error,
  search,
  onSearchChange,
  onSelect,
  disabled,
  emptyLabel = "No hay plantillas aprobadas en Meta",
}: WhatsAppTemplateListProps) {
  const query = search.trim().toLowerCase();
  const filtered = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(query) ||
      template.preview.toLowerCase().includes(query) ||
      template.language.toLowerCase().includes(query)
  );

  return (
    <>
      <div className="p-3 border-b border-[var(--color-border-primary)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar plantillas"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg pl-9 pr-3 py-2.5 outline-none border border-transparent focus:border-[var(--color-brand)]"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto py-1.5">
        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando plantillas…
          </div>
        )}

        {!loading && error && (
          <p className="px-4 py-6 text-sm text-center text-red-400">{error}</p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-center text-[var(--color-text-muted)]">
            {templates.length === 0 ? emptyLabel : "Sin resultados"}
          </p>
        )}

        {!loading &&
          !error &&
          filtered.map((template) => (
            <button
              key={template.id}
              type="button"
              disabled={disabled || !template.supported}
              onClick={() => onSelect(template)}
              title={template.unsupportedReason}
              className="w-full px-4 py-2.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {template.name}
                </p>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] shrink-0">
                  {template.language}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                {template.preview}
              </p>
              {!template.supported && template.unsupportedReason && (
                <p className="text-[11px] text-amber-400 mt-1">{template.unsupportedReason}</p>
              )}
            </button>
          ))}
      </div>
    </>
  );
}
