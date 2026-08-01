import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCannedResponseStore } from "@/store/cannedResponseStore";
import { useUIStore } from "@/store/uiStore";

interface CannedResponsesPopoverProps {
  onSelect: (content: string) => void;
}

type FormMode = "list" | "create" | "edit";

export function CannedResponsesPopover({ onSelect }: CannedResponsesPopoverProps) {
  const responses = useCannedResponseStore((s) => s.responses);
  const addResponse = useCannedResponseStore((s) => s.addResponse);
  const updateResponse = useCannedResponseStore((s) => s.updateResponse);
  const deleteResponse = useCannedResponseStore((s) => s.deleteResponse);
  const showToast = useUIStore((s) => s.showToast);

  const [mode, setMode] = useState<FormMode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const resetForm = () => {
    setTitle("");
    setContent("");
    setEditingId(null);
    setMode("list");
  };

  const startCreate = () => {
    setTitle("");
    setContent("");
    setEditingId(null);
    setMode("create");
  };

  const startEdit = (id: string) => {
    const response = responses.find((item) => item.id === id);
    if (!response) return;

    setEditingId(id);
    setTitle(response.title);
    setContent(response.content);
    setMode("edit");
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      showToast("Completa el título y el mensaje");
      return;
    }

    if (mode === "edit" && editingId) {
      updateResponse(editingId, title, content);
      showToast("Respuesta actualizada");
    } else {
      addResponse(title, content);
      showToast("Respuesta creada");
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    deleteResponse(id);
    if (editingId === id) resetForm();
    showToast("Respuesta eliminada");
  };

  const isFormMode = mode === "create" || mode === "edit";

  return (
    <div
      className="absolute bottom-full right-0 mb-2 z-30 w-[300px] bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-xl overflow-hidden animate-fade-in"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-primary)]">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          {isFormMode ? (mode === "edit" ? "Editar respuesta" : "Nueva respuesta") : "Respuestas predefinidas"}
        </p>
        {isFormMode && (
          <button
            type="button"
            onClick={resetForm}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
            title="Volver"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isFormMode ? (
        <div className="px-4 py-3 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] mb-1.5">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Saludo, Espera..."
              className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)]"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] mb-1.5">
              Mensaje
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Texto que se insertará en el chat..."
              rows={4}
              className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)] resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="h-8 px-3 text-xs rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-8 px-3 text-xs font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="max-h-72 overflow-y-auto py-1.5">
            {responses.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                  No hay respuestas todavía
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                  Crea atajos para responder más rápido
                </p>
                <button
                  type="button"
                  onClick={startCreate}
                  className="h-8 px-3 text-xs font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir respuesta
                </button>
              </div>
            ) : (
              responses.map((response) => (
                <div
                  key={response.id}
                  className="group flex items-start gap-1 px-2 py-1 hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(response.content)}
                    className="flex-1 min-w-0 px-2 py-1.5 text-left rounded-lg"
                  >
                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      {response.title}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                      {response.content}
                    </p>
                  </button>
                  <div className="flex items-center gap-0.5 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(response.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(response.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {responses.length > 0 && (
            <div className="px-3 py-2 border-t border-[var(--color-border-primary)]">
              <button
                type="button"
                onClick={startCreate}
                className={cn(
                  "w-full h-8 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5",
                  "text-[var(--color-brand)] hover:bg-[var(--color-brand-bg)]"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir respuesta
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
