import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
  onSelect: (response: CannedResponse) => void;
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
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<FormMode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [hasExistingImage, setHasExistingImage] = useState(false);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("list");
      setEditingId(null);
      setExpandedId(null);
      setTitle("");
      setContent("");
      setImageFile(null);
      setExistingImageUrl(null);
      setHasExistingImage(false);
      setRemoveExistingImage(false);
    }
  }, [open]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (mode !== "list") {
        setTitle("");
        setContent("");
        setEditingId(null);
        setImageFile(null);
        setExistingImageUrl(null);
        setHasExistingImage(false);
        setRemoveExistingImage(false);
        setMode("list");
      } else {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mode, onClose]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setEditingId(null);
    setImageFile(null);
    setExistingImageUrl(null);
    setHasExistingImage(false);
    setRemoveExistingImage(false);
    setMode("list");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  if (!open) return null;

  const startCreate = () => {
    if (!canManage || !inboxId) return;
    setTitle("");
    setContent("");
    setEditingId(null);
    setExpandedId(null);
    setImageFile(null);
    setExistingImageUrl(null);
    setHasExistingImage(false);
    setRemoveExistingImage(false);
    setMode("create");
  };

  const startEdit = (response: CannedResponse) => {
    if (!canManage) return;
    setEditingId(response.id);
    setTitle(response.title);
    setContent(response.content);
    setImageFile(null);
    setExistingImageUrl(response.fileUrl ?? null);
    setHasExistingImage(Boolean(response.fileUrl || response.attachmentUrl));
    setRemoveExistingImage(false);
    setMode("edit");
  };

  const busy =
    createResponse.isPending || updateResponse.isPending || deleteResponse.isPending;

  const hasImage =
    Boolean(imageFile) || (hasExistingImage && !removeExistingImage);

  const handlePickImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Solo se permiten imágenes");
      return;
    }
    setImageFile(file);
    setRemoveExistingImage(false);
  };

  const clearImage = () => {
    setImageFile(null);
    if (hasExistingImage) setRemoveExistingImage(true);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleSave = async () => {
    const normalizedContent = normalizeMarkdownToWhatsApp(content).trim();
    if (!title.trim()) {
      showToast("Completa el código corto");
      return;
    }
    if (!normalizedContent && !hasImage) {
      showToast("Añade un mensaje o una imagen");
      return;
    }

    try {
      if (mode === "edit" && editingId) {
        await updateResponse.mutateAsync({
          id: editingId,
          title,
          content: normalizedContent,
          imageFile,
          removeImage: removeExistingImage && !imageFile,
        });
        showToast("Respuesta actualizada");
      } else {
        await createResponse.mutateAsync({
          title,
          content: normalizedContent,
          imageFile,
        });
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

  const selectResponse = (response: CannedResponse) => {
    onSelect({
      ...response,
      content: normalizeMarkdownToWhatsApp(response.content),
    });
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
  const previewSrc =
    imagePreviewUrl ||
    (!removeExistingImage && existingImageUrl ? existingImageUrl : null);
  const showImageSlot = Boolean(previewSrc) || (hasExistingImage && !removeExistingImage && !imageFile);

  return createPortal(
    <div data-modal-overlay className="fixed inset-0 z-[80] flex items-center justify-center p-4">
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
                  placeholder="Pega desde Chatwoot o escribe con *negrita*… (opcional si hay imagen)"
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

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  Imagen (opcional)
                </label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePickImage(e.target.files?.[0] ?? null)}
                />
                {previewSrc ? (
                  <div className="relative rounded-xl overflow-hidden border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]">
                    <img
                      src={previewSrc}
                      alt="Vista previa"
                      className="w-full max-h-44 object-contain bg-[var(--color-bg-primary)]"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      title="Quitar imagen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : showImageSlot ? (
                  <div className="relative rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] px-3 py-6 text-center">
                    <ImagePlus className="w-5 h-5 mx-auto text-[var(--color-brand)] mb-1.5" />
                    <p className="text-sm text-[var(--color-text-secondary)]">Imagen adjunta</p>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="mt-2 text-xs text-[var(--color-danger)] hover:opacity-80"
                    >
                      Quitar imagen
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full h-24 rounded-xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors inline-flex flex-col items-center justify-center gap-1.5"
                  >
                    <ImagePlus className="w-5 h-5" />
                    Añadir imagen
                  </button>
                )}
                {(previewSrc || showImageSlot) && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="mt-2 text-xs text-[var(--color-brand)] hover:opacity-80 transition-opacity"
                  >
                    Cambiar imagen
                  </button>
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
                    const hasMedia = Boolean(response.fileUrl || response.attachmentUrl);
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
                            {hasMedia && (
                              <ImagePlus className="w-3.5 h-3.5 text-[var(--color-brand)] shrink-0" />
                            )}
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
                            <div className="px-3 pb-3 pt-0.5 border-t border-[var(--color-border-primary)]/60 space-y-2.5">
                              {hasMedia && response.fileUrl && (
                                <img
                                  src={response.fileUrl}
                                  alt=""
                                  className="mt-2.5 w-full max-h-36 object-contain rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)]"
                                />
                              )}
                              {response.content.trim() ? (
                                <WhatsAppFormattedText
                                  as="div"
                                  text={normalizeMarkdownToWhatsApp(response.content)}
                                  className="text-sm text-[var(--color-text-secondary)] leading-relaxed pt-1"
                                />
                              ) : (
                                <p className="text-xs text-[var(--color-text-muted)] pt-1 italic">
                                  Solo imagen
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={() => selectResponse(response)}
                                className="h-8 px-3 text-xs font-medium rounded-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] transition-colors"
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
