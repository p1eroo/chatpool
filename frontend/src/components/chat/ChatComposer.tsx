import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { getClipboardAttachmentFile, isAcceptedAttachmentFile } from "@/lib/attachmentUtils";
import { cn } from "@/lib/utils";
import { VoiceRecorderBar } from "@/components/chat/VoiceRecorderBar";
import { ComposerEmojiPicker } from "@/components/chat/ComposerEmojiPicker";
import { CannedResponsesPopover } from "@/components/chat/CannedResponsesPopover";
import { FileAttachmentCard } from "@/components/chat/FileAttachmentCard";
import { WhatsAppTemplateList } from "@/components/chat/WhatsAppTemplateList";
import { WhatsAppTemplateParamForm } from "@/components/chat/WhatsAppTemplateParamForm";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { voiceFileFromBlob } from "@/lib/voiceRecording";
import { formatVoiceTime, type VoiceRecordingResult } from "@/hooks/useVoiceRecorder";
import type { WhatsAppTemplate } from "@/types/whatsappTemplate";
import {
  buildTemplatePreviewContent,
  templateNeedsParams,
} from "@/types/whatsappTemplate";
import {
  Smile,
  Paperclip,
  Zap,
  Send,
  MessageSquare,
  CornerUpLeft,
  X,
  Mic,
  StickyNote,
} from "lucide-react";

interface PendingAttachment {
  file: File;
  url: string;
}

type PopoverId = "emoji" | "canned" | "template" | null;

export function ChatComposer() {
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const sendTemplateMessage = useConversationStore((s) => s.sendTemplateMessage);
  const {
    replyToMessage,
    setReplyToMessage,
    noteAboutMessage,
    setNoteAboutMessage,
    showToast,
    attachFileRequest,
    clearAttachFileRequest,
  } = useUIStore();

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );
  const isWhatsApp = activeConversation?.channelType === "whatsapp";
  const { templates, loading: templatesLoading, error: templatesError } = useWhatsAppTemplates(
    isWhatsApp ? activeConversation?.inboxId : null
  );

  const [content, setContent] = useState("");
  const [activePopover, setActivePopover] = useState<PopoverId>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [bodyParameters, setBodyParameters] = useState<string[]>([]);
  const [headerParameters, setHeaderParameters] = useState<string[]>([]);
  const [buttonUrlParameters, setButtonUrlParameters] = useState<Record<number, string>>({});
  const [draftTemplate, setDraftTemplate] = useState<WhatsAppTemplate | null>(null);
  const [draftBodyParameters, setDraftBodyParameters] = useState<string[]>([]);
  const [draftHeaderParameters, setDraftHeaderParameters] = useState<string[]>([]);
  const [draftButtonUrlParameters, setDraftButtonUrlParameters] = useState<Record<number, string>>(
    {}
  );
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const pendingAttachmentRef = useRef<PendingAttachment | null>(null);

  pendingAttachmentRef.current = pendingAttachment;

  const isTemplateLocked = selectedTemplate !== null;

  useEffect(() => {
    if (replyToMessage || noteAboutMessage) {
      textareaRef.current?.focus();
    }
  }, [replyToMessage, noteAboutMessage]);

  useEffect(() => {
    setReplyToMessage(null);
    setNoteAboutMessage(null);
    setContent("");
    setSelectedTemplate(null);
    setBodyParameters([]);
    setHeaderParameters([]);
    setButtonUrlParameters({});
    setDraftTemplate(null);
    setTemplateSearch("");
    setActivePopover(null);
    setIsRecording(false);
    setPendingAttachment((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, [activeConversationId, setReplyToMessage, setNoteAboutMessage]);

  useEffect(() => {
    return () => {
      const pending = pendingAttachmentRef.current;
      if (pending?.url) URL.revokeObjectURL(pending.url);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const stageFile = useCallback(
    (file: File) => {
      if (!activeConversationId) return false;
      if (noteAboutMessage) return false;
      if (isTemplateLocked) return false;
      if (!isAcceptedAttachmentFile(file)) return false;

      setPendingAttachment((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { file, url: URL.createObjectURL(file) };
      });
      setActivePopover(null);
      textareaRef.current?.focus();
      return true;
    },
    [activeConversationId, noteAboutMessage, isTemplateLocked]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = getClipboardAttachmentFile(e.clipboardData);
      if (!file) return;

      e.preventDefault();

      if (noteAboutMessage) {
        showToast("No puedes adjuntar archivos en una nota privada");
        return;
      }
      if (isTemplateLocked) {
        showToast("No puedes adjuntar archivos con una plantilla seleccionada");
        return;
      }
      if (!stageFile(file)) {
        showToast("Tipo de archivo no soportado");
      }
    },
    [noteAboutMessage, isTemplateLocked, stageFile, showToast]
  );

  useEffect(() => {
    if (!attachFileRequest) return;

    if (!stageFile(attachFileRequest)) {
      if (noteAboutMessage) {
        showToast("No puedes adjuntar archivos en una nota privada");
      } else {
        showToast("Tipo de archivo no soportado");
      }
    }

    clearAttachFileRequest();
  }, [
    attachFileRequest,
    stageFile,
    clearAttachFileRequest,
    noteAboutMessage,
    showToast,
  ]);

  const insertAtCursor = useCallback((text: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => prev + text);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    setContent((prev) => prev.slice(0, start) + text + prev.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const nextPos = start + text.length;
      el.setSelectionRange(nextPos, nextPos);
    });
  }, []);

  const clearTemplate = useCallback(() => {
    setSelectedTemplate(null);
    setBodyParameters([]);
    setHeaderParameters([]);
    setButtonUrlParameters({});
    setContent("");
  }, []);

  const handleSend = useCallback(() => {
    if (!activeConversationId || sendingTemplate) return;

    if (selectedTemplate) {
      const paramsReady =
        bodyParameters.every((value) => value.trim()) &&
        headerParameters.every((value) => value.trim()) &&
        selectedTemplate.buttonUrlParamIndexes.every((index) =>
          buttonUrlParameters[index]?.trim()
        );

      if (!paramsReady) {
        showToast("Completa todas las variables de la plantilla");
        return;
      }

      const preview = buildTemplatePreviewContent(
        selectedTemplate,
        bodyParameters,
        headerParameters
      );

      setSendingTemplate(true);
      void sendTemplateMessage(activeConversationId, {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        language: selectedTemplate.language,
        content: preview,
        bodyParameters,
        headerParameters,
        buttonUrlParameters: selectedTemplate.buttonUrlParamIndexes.map((index) => ({
          index,
          text: buttonUrlParameters[index] ?? "",
        })),
      })
        .then((ok) => {
          if (!ok) {
            showToast("Meta rechazó la plantilla");
            return;
          }
          clearTemplate();
          setReplyToMessage(null);
          setNoteAboutMessage(null);
          showToast("Plantilla enviada correctamente");
        })
        .finally(() => setSendingTemplate(false));
      return;
    }

    const caption = content.trim();
    const attachment = pendingAttachment;

    if (attachment) {
      const { file } = attachment;
      const isImage = file.type.startsWith("image/");

      sendMessage(activeConversationId, caption || file.name, false, {
        replyToMessageId: replyToMessage?.id,
        contentType: isImage ? "image" : "file",
        fileName: file.name,
        fileSize: file.size,
        file,
      });

      setPendingAttachment(null);
      setContent("");
      setReplyToMessage(null);
      setNoteAboutMessage(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      return;
    }

    if (!caption) return;

    sendMessage(activeConversationId, caption, Boolean(noteAboutMessage), {
      attachedToMessageId: noteAboutMessage?.id,
      replyToMessageId: noteAboutMessage ? undefined : replyToMessage?.id,
    });
    setContent("");
    setReplyToMessage(null);
    setNoteAboutMessage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [
    content,
    activeConversationId,
    noteAboutMessage,
    replyToMessage,
    pendingAttachment,
    sendMessage,
    sendTemplateMessage,
    selectedTemplate,
    bodyParameters,
    headerParameters,
    buttonUrlParameters,
    sendingTemplate,
    clearTemplate,
    showToast,
    setReplyToMessage,
    setNoteAboutMessage,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isTemplateLocked) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  const handleVoiceSend = useCallback(
    (result: VoiceRecordingResult) => {
      if (!activeConversationId) return;

      sendMessage(activeConversationId, formatVoiceTime(result.durationSeconds), false, {
        contentType: "audio",
        audioDuration: result.durationSeconds,
        replyToMessageId: replyToMessage?.id,
        file: voiceFileFromBlob(result.blob),
      });
      setReplyToMessage(null);
      setIsRecording(false);
      showToast("Nota de voz enviada");
    },
    [activeConversationId, replyToMessage, sendMessage, setReplyToMessage, showToast]
  );

  const startRecording = () => {
    if (isTemplateLocked || !activeConversationId) return;
    setActivePopover(null);
    setIsRecording(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!stageFile(file)) {
      showToast("No se puede adjuntar este archivo");
    }

    e.target.value = "";
  };

  const clearPendingAttachment = () => {
    setPendingAttachment((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const templateParamsReady =
    !selectedTemplate ||
    (bodyParameters.every((value) => value.trim()) &&
      headerParameters.every((value) => value.trim()) &&
      selectedTemplate.buttonUrlParamIndexes.every((index) => buttonUrlParameters[index]?.trim()));

  const canSend =
    !sendingTemplate &&
    (selectedTemplate
      ? templateParamsReady
      : Boolean(content.trim() || pendingAttachment));

  const togglePopover = (id: PopoverId) => {
    setActivePopover((prev) => (prev === id ? null : id));
  };

  const applyCannedResponse = (text: string) => {
    if (isTemplateLocked) return;
    setContent(text);
    setActivePopover(null);
    textareaRef.current?.focus();
  };

  const applyTemplateSelection = (template: WhatsAppTemplate) => {
    if (!template.supported) {
      showToast(template.unsupportedReason ?? "Plantilla no soportada");
      return;
    }

    const body = Array.from({ length: template.bodyParamCount }, () => "");
    const header = Array.from({ length: template.headerParamCount }, () => "");
    const buttons = Object.fromEntries(
      template.buttonUrlParamIndexes.map((index) => [index, ""])
    );

    setSelectedTemplate(template);
    setBodyParameters(body);
    setHeaderParameters(header);
    setButtonUrlParameters(buttons);
    setContent(buildTemplatePreviewContent(template, body, header));
    setDraftTemplate(null);
    setActivePopover(null);
    setPendingAttachment((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    textareaRef.current?.focus();
  };

  const handlePickTemplate = (template: WhatsAppTemplate) => {
    if (!template.supported) {
      showToast(template.unsupportedReason ?? "Plantilla no soportada");
      return;
    }

    if (!templateNeedsParams(template)) {
      applyTemplateSelection(template);
      return;
    }

    setDraftTemplate(template);
    setDraftBodyParameters(Array.from({ length: template.bodyParamCount }, () => ""));
    setDraftHeaderParameters(Array.from({ length: template.headerParamCount }, () => ""));
    setDraftButtonUrlParameters(
      Object.fromEntries(template.buttonUrlParamIndexes.map((index) => [index, ""]))
    );
  };

  const toolbarDisabled = isRecording;

  return (
    <div
      ref={composerRef}
      className={cn(
        "border-t border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-3",
        noteAboutMessage && "border-t-amber-500/30"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileChange}
      />

      {noteAboutMessage && (
        <div className="flex items-start gap-2 mb-2 px-1 py-2 rounded-lg bg-[var(--color-note-bg)] border-l-[3px] border-amber-500/60">
          <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-amber-400 mb-0.5">
              Nota sobre mensaje de {noteAboutMessage.senderName || "contacto"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] truncate">
              {noteAboutMessage.content}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNoteAboutMessage(null)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors shrink-0"
            title="Cancelar nota"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {replyToMessage && !noteAboutMessage && (
        <div className="flex items-start gap-2 mb-2 px-1 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border-l-[3px] border-[var(--color-brand)]">
          <CornerUpLeft className="w-3.5 h-3.5 text-[var(--color-brand)] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-[var(--color-brand)] mb-0.5">
              Respondiendo a {replyToMessage.senderName || "mensaje"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] truncate">
              {replyToMessage.content}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyToMessage(null)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors shrink-0"
            title="Cancelar respuesta"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isTemplateLocked && selectedTemplate && (
        <div className="mb-2 space-y-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)]">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-medium text-[var(--color-text-primary)] flex-1 truncate">
              Plantilla: {selectedTemplate.name}
              <span className="text-[var(--color-text-muted)] font-normal">
                {" "}
                · {selectedTemplate.language}
              </span>
            </span>
            <button
              type="button"
              onClick={clearTemplate}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              title="Quitar plantilla"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {templateNeedsParams(selectedTemplate) && (
            <div className="space-y-2 px-1">
              {selectedTemplate.headerParamCount > 0 &&
                Array.from({ length: selectedTemplate.headerParamCount }, (_, index) => (
                  <input
                    key={`composer-header-${index}`}
                    type="text"
                    value={headerParameters[index] ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHeaderParameters((prev) => {
                        const next = prev.map((item, i) => (i === index ? value : item));
                        setContent(
                          buildTemplatePreviewContent(selectedTemplate, bodyParameters, next)
                        );
                        return next;
                      });
                    }}
                    placeholder={`Encabezado {{${index + 1}}}`}
                    className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)]"
                  />
                ))}
              {selectedTemplate.bodyParamCount > 0 &&
                Array.from({ length: selectedTemplate.bodyParamCount }, (_, index) => (
                  <input
                    key={`composer-body-${index}`}
                    type="text"
                    value={bodyParameters[index] ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBodyParameters((prev) => {
                        const next = prev.map((item, i) => (i === index ? value : item));
                        setContent(
                          buildTemplatePreviewContent(selectedTemplate, next, headerParameters)
                        );
                        return next;
                      });
                    }}
                    placeholder={`Variable {{${index + 1}}}`}
                    className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)]"
                  />
                ))}
              {selectedTemplate.buttonUrlParamIndexes.map((index) => (
                <input
                  key={`composer-button-${index}`}
                  type="text"
                  value={buttonUrlParameters[index] ?? ""}
                  onChange={(e) =>
                    setButtonUrlParameters((prev) => ({ ...prev, [index]: e.target.value }))
                  }
                  placeholder={`Botón URL #${index + 1}`}
                  className="w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)]"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {pendingAttachment && !isRecording && (
        <div className="mb-2 px-1">
          {pendingAttachment.file.type.startsWith("image/") ? (
            <div className="relative inline-block">
              <img
                src={pendingAttachment.url}
                alt={pendingAttachment.file.name}
                className="max-h-32 max-w-[220px] rounded-xl border border-[var(--color-border-primary)] object-cover"
              />
              <button
                type="button"
                onClick={clearPendingAttachment}
                className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                title="Quitar archivo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <FileAttachmentCard
              fileName={pendingAttachment.file.name}
              fileSize={pendingAttachment.file.size}
              variant="composer"
              onRemove={clearPendingAttachment}
            />
          )}
        </div>
      )}

      {isRecording ? (
        <VoiceRecorderBar
          onSend={handleVoiceSend}
          onCancel={() => setIsRecording(false)}
          onError={(message) => showToast(message)}
        />
      ) : (
        <div className="flex items-end bg-[var(--color-bg-tertiary)] rounded-xl border border-transparent focus-within:border-[var(--color-brand)] transition-colors relative">
          <div className="flex items-center gap-0.5 pl-1 pb-1.5 shrink-0 relative">
            <ToolbarButton
              title="Emoji"
              disabled={isTemplateLocked}
              active={activePopover === "emoji"}
              onClick={() => togglePopover("emoji")}
            >
              <Smile className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              title="Adjuntar archivo"
              disabled={toolbarDisabled || isTemplateLocked}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4" />
            </ToolbarButton>

            {isWhatsApp && (
              <ToolbarButton
                title="Plantillas de WhatsApp"
                disabled={toolbarDisabled || isRecording}
                active={activePopover === "template"}
                onClick={() => {
                  setDraftTemplate(null);
                  togglePopover("template");
                }}
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
              </ToolbarButton>
            )}

            {activePopover === "emoji" && (
              <ComposerEmojiPicker
                align="left"
                onEmojiSelect={(emoji) => insertAtCursor(emoji)}
              />
            )}

            {activePopover === "template" && (
              <ComposerPopover title="Plantillas de WhatsApp" wide align="left">
                {draftTemplate ? (
                  <WhatsAppTemplateParamForm
                    template={draftTemplate}
                    bodyParameters={draftBodyParameters}
                    headerParameters={draftHeaderParameters}
                    buttonUrlParameters={draftButtonUrlParameters}
                    onBodyChange={(index, value) =>
                      setDraftBodyParameters((prev) =>
                        prev.map((item, i) => (i === index ? value : item))
                      )
                    }
                    onHeaderChange={(index, value) =>
                      setDraftHeaderParameters((prev) =>
                        prev.map((item, i) => (i === index ? value : item))
                      )
                    }
                    onButtonChange={(index, value) =>
                      setDraftButtonUrlParameters((prev) => ({ ...prev, [index]: value }))
                    }
                    onCancel={() => setDraftTemplate(null)}
                    onConfirm={() => {
                      setSelectedTemplate(draftTemplate);
                      setBodyParameters(draftBodyParameters);
                      setHeaderParameters(draftHeaderParameters);
                      setButtonUrlParameters(draftButtonUrlParameters);
                      setContent(
                        buildTemplatePreviewContent(
                          draftTemplate,
                          draftBodyParameters,
                          draftHeaderParameters
                        )
                      );
                      setDraftTemplate(null);
                      setActivePopover(null);
                    }}
                  />
                ) : (
                  <WhatsAppTemplateList
                    templates={templates}
                    loading={templatesLoading}
                    error={templatesError}
                    search={templateSearch}
                    onSearchChange={setTemplateSearch}
                    onSelect={handlePickTemplate}
                  />
                )}
              </ComposerPopover>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              if (!isTemplateLocked) setContent(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onInput={handleInput}
            placeholder={
              noteAboutMessage ? "Escribe una nota privada..." : "Escribe un mensaje..."
            }
            readOnly={isTemplateLocked}
            rows={1}
            className={cn(
              "flex-1 bg-transparent text-sm placeholder:text-[var(--color-text-muted)] resize-none outline-none px-2 py-2.5 max-h-[120px] min-w-0",
              isTemplateLocked
                ? "text-[var(--color-text-secondary)] cursor-default"
                : "text-[var(--color-text-primary)]"
            )}
          />

          <div className="flex items-center gap-0.5 pr-1 pb-1.5 shrink-0 relative">
            <ToolbarButton
              title="Grabar audio"
              disabled={toolbarDisabled || isTemplateLocked}
              onClick={startRecording}
            >
              <Mic className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              title="Respuestas predefinidas"
              disabled={toolbarDisabled || isTemplateLocked}
              active={activePopover === "canned"}
              onClick={() => togglePopover("canned")}
            >
              <Zap className="w-4 h-4" />
            </ToolbarButton>

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              title="Enviar mensaje"
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg text-white transition-all shrink-0",
                !canSend
                  ? "bg-[var(--color-brand)]/40 cursor-not-allowed"
                  : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] active:scale-95"
              )}
            >
              <Send className="w-4 h-4" />
            </button>

            {activePopover === "canned" && (
              <CannedResponsesPopover onSelect={applyCannedResponse} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  title,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
        disabled
          ? "opacity-40 cursor-not-allowed text-[var(--color-text-muted)]"
          : active
            ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
      )}
    >
      {children}
    </button>
  );
}

function ComposerPopover({
  title,
  children,
  wide,
  align = "right",
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "absolute bottom-full mb-2 z-30 bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-xl overflow-hidden animate-fade-in",
        wide ? "w-[340px]" : "w-[300px]",
        align === "left" ? "left-0" : "right-0"
      )}
    >
      <div className="px-4 py-2.5 border-b border-[var(--color-border-primary)]">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}
