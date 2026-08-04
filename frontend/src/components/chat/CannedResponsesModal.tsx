import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clipboardToWhatsApp,
  insertClipboardWhatsAppIntoTextarea,
} from "@/lib/htmlToWhatsApp";
import { normalizeMarkdownToWhatsApp } from "@/lib/normalizeMarkdownToWhatsApp";
import { WhatsAppFormattedText } from "@/lib/whatsappFormatting";
import { useHasPermission } from "@/hooks/useAgentPermissions";
import {
  useCannedResponses,
  useCreateCannedResponse,
  useDeleteCannedResponse,
  useUpdateCannedResponse,
} from "@/hooks/useCannedResponses";
import { useUIStore } from "@/store/uiStore";
import type { CannedResponse } from "@/types";

interface CannedResponsesModalProps {
  open: boolean;
  inboxId: string | null;
  onClose: () => void;
  onSelect: (content: string) => void;
}

type FormMode = "list" | "create" | "edit";

export function CannedResponsesModal({
  open,
  inboxId,
  onClose,
  onSelect,
}: CannedResponsesModalProps) {
  const canManage = useHasPermission("manageCannedResponses");
  const showToast = useUIStore((s) => s.showToast);
  const { data: responses = [], isLoading, isError } = useCannedResponses(inboxId);
  const createResponse = useCreateCannedResponse(inboxId);
  const updateResponse = useUpdateCannedResponse(inboxId);
  const deleteResponse = useDeleteCannedResponse(inboxId);

  const [mode, setMode] = useState<FormMode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) {
      setMode("list");
      setEditingId(null);
      setExpandedId(null);
      setTitle("");
      setContent("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (mode !== "list") {
          setMode("list");
          setEditingId(null);
          setTitle("");
          setContent("");
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mode, onClose]);

  if (!open) return null;

  const resetForm = () => {
    setTitle("");
    setContent("");
    setEditingId(null);
    setMode("list");
  };

  const startCreate = () => {
    if (!canManage || !inboxId) return;
    setTitle("");
    setContent("");
    setEditingId(null);
    setExpandedId(null);
    setMode("create");
  };

  const startEdit = (response: CannedResponse) => {
    if (!canManage) return;
    setEditingId(response.id);
    setTitle(response.title);
    setContent(response.content);
    setMode("edit");
  };

  const busy =
    createResponse.isPending || updateResponse.isPending || deleteResponse.isPending;

  const handleSave = async () => {
    const normalizedContent = normalizeMarkdownToWhatsApp(content).trim();
    if (!title.trim() || !normalizedContent) {
      showToast("Completa el título y el mensaje");
      return;
    }

    try {
      if (mode === "edit" && editingId) {
        await updateResponse.mutateAsync({
          id: editingId,
          title,
          content: normalizedContent,
        });
        showToast("Respuesta actualizada");
      } else {
        await createResponse.mutateAsync({ title, content: normalizedContent });
        showToast("Respuesta creada");
      }
      resetForm();
    } catch {
      showToast("No se pudo guardar la respuesta");
    }
  };

  const handleContentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const data = e.clipboardData;
    const hasHtml = Boolean(data.getData("text/html")?.trim());
    const hasPlain = Boolean(data.getData("text/plain")?.trim());
    if (!hasHtml && !hasPlain) return;

    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const inserted = clipboardToWhatsApp(data);
    const next = insertClipboardWhatsAppIntoTextarea(el, data, content);
    setContent(next);

    requestAnimationFrame(() => {
      const pos = start + inserted.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const selectResponse = (raw: string) => {
    onSelect(normalizeMarkdownToWhatsApp(raw));
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteResponse.mutateAsync(id);
      if (editingId === id) resetForm();
      if (expandedId === id) setExpandedId(null);
      showToast("Respuesta eliminada");
    } catch {
      showToast("No se pudo eliminar la respuesta");
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const isFormMode = mode === "create" || mode === "edit";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[min(80vh,640px)] flex flex-col rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] shadow-2xl animate-fade-in overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {isFormMode
                ? mode === "edit"
                  ? "Editar respuesta"
                  : "Nueva respuesta"
                : "Respuestas predefinidas"}
            </h2>
            {!isFormMode && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {responses.length}{" "}
                {responses.length === 1 ? "respuesta" : "respuestas"} de este buzón
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isFormMode && canManage && inboxId && (
          <div className="px-4 pb-3 shrink-0">
            <button
              type="button"
              onClick={startCreate}
              className="w-full h-10 rounded-xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-bg-tertiary)] text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Añadir respuesta
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          {!inboxId ? (
            <div className="py-12 text-center px-2">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Abre una conversación para gestionar las respuestas de su buzón.
              </p>
            </div>
          ) : isFormMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  Código corto
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. saludo, espera..."
                  className="w-full h-10 bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 outline-none border border-[var(--color-border-primary)] focus:border-[var(--color-brand)]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  Contenido
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onPaste={handleContentPaste}
                  placeholder="Pega desde Chatwoot o escribe con *negrita*…"
                  rows={5}
                  className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2.5 outline-none border border-[var(--color-border-primary)] focus:border-[var(--color-brand)] resize-none"
                />
                <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                  Puedes pegar desde Chatwoot (negritas, cursivas y listas) o con **markdown**; se
                  convierte al formato de WhatsApp.
                </p>
                {content.trim() && (
                  <div className="mt-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">
                      Vista previa
                    </p>
                    <WhatsAppFormattedText
                      as="div"
                      text={normalizeMarkdownToWhatsApp(content)}
                      className="text-sm text-[var(--color-text-primary)] leading-relaxed"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={busy}
                  className="h-9 px-3 text-sm rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={busy}
                  className="h-9 px-4 text-sm font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-14 text-sm text-[var(--color-text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando…
                </div>
              )}

              {!isLoading && isError && (
                <p className="py-14 text-center text-sm text-red-400">
                  No se pudieron cargar las respuestas
                </p>
              )}

              {!isLoading && !isError && responses.length === 0 && (
                <div className="py-12 text-center px-2">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Este buzón aún no tiene respuestas
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                    Añade atajos propios de esta bandeja. Con{" "}
                    <span className="text-[var(--color-text-secondary)]">/</span> en el chat
                    podrás usarlos rápido.
                  </p>
                </div>
              )}

              {!isLoading && !isError && responses.length > 0 && (
                <div className="space-y-2">
                  {responses.map((response) => {
                    const expanded = expandedId === response.id;
                    return (
                      <div
                        key={response.id}
                        className={cn(
                          "rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] overflow-hidden transition-colors",
                          expanded && "border-[var(--color-brand)]/40"
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(response.id)}
                            className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
                          >
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 text-[var(--color-text-muted)] shrink-0 transition-transform duration-200",
                                expanded && "rotate-180"
                              )}
                            />
                            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              /{response.title}
                            </span>
                          </button>

                          {canManage && (
                            <div className="flex items-center gap-0.5 pr-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEdit(response)}
                                disabled={busy}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(response.id)}
                                disabled={busy}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div
                          className={cn(
                            "grid transition-[grid-template-rows] duration-200 ease-out",
                            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          )}
                        >
                          <div className="overflow-hidden min-h-0">
                            <div className="px-3 pb-3 pt-0.5 border-t border-[var(--color-border-primary)]/60">
                              <WhatsAppFormattedText
                                as="div"
                                text={normalizeMarkdownToWhatsApp(response.content)}
                                className="text-sm text-[var(--color-text-secondary)] leading-relaxed pt-2.5"
                              />
                              <button
                                type="button"
                                onClick={() => selectResponse(response.content)}
                                className="mt-3 h-8 px-3 text-xs font-medium rounded-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] transition-colors"
                              >
                                Usar en el mensaje
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
