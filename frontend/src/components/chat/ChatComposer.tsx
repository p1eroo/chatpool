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
import { buildTemplatePreviewContent } from "@/types/whatsappTemplate";
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

  useEffect(() => {
    if (replyToMessage || noteAboutMessage) {
      textareaRef.current?.focus();
    }
  }, [replyToMessage, noteAboutMessage]);

  useEffect(() => {
    setReplyToMessage(null);
    setNoteAboutMessage(null);
    setContent("");
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
      if (!isAcceptedAttachmentFile(file)) return false;

      setPendingAttachment((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { file, url: URL.createObjectURL(file) };
      });
      setActivePopover(null);
      textareaRef.current?.focus();
      return true;
    },
    [activeConversationId, noteAboutMessage]
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
      if (!stageFile(file)) {
        showToast("Tipo de archivo no soportado");
      }
    },
    [noteAboutMessage, stageFile, showToast]
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

  const handleSend = useCallback(() => {
    if (!activeConversationId || sendingTemplate) return;

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
    sendingTemplate,
    setReplyToMessage,
    setNoteAboutMessage,
  ]);

  const sendDraftTemplate = useCallback(() => {
    if (!activeConversationId || !draftTemplate || sendingTemplate) return;

    const preview = buildTemplatePreviewContent(
      draftTemplate,
      draftBodyParameters,
      draftHeaderParameters
    );

    setSendingTemplate(true);
    void sendTemplateMessage(activeConversationId, {
      templateId: draftTemplate.id,
      templateName: draftTemplate.name,
      language: draftTemplate.language,
      content: preview,
      bodyParameters: draftBodyParameters,
      headerParameters: draftHeaderParameters,
      buttonUrlParameters: draftTemplate.buttonUrlParamIndexes.map((index) => ({
        index,
        text: draftButtonUrlParameters[index] ?? "",
      })),
    })
      .then((ok) => {
        if (!ok) {
          showToast("Meta rechazó la plantilla");
          return;
        }
        setDraftTemplate(null);
        setActivePopover(null);
        setReplyToMessage(null);
        setNoteAboutMessage(null);
        showToast("Plantilla enviada correctamente");
      })
      .finally(() => setSendingTemplate(false));
  }, [
    activeConversationId,
    draftTemplate,
    draftBodyParameters,
    draftHeaderParameters,
    draftButtonUrlParameters,
    sendingTemplate,
    sendTemplateMessage,
    showToast,
    setReplyToMessage,
    setNoteAboutMessage,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
    if (!activeConversationId) return;
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

  const canSend = !sendingTemplate && Boolean(content.trim() || pendingAttachment);

  const togglePopover = (id: PopoverId) => {
    setActivePopover((prev) => (prev === id ? null : id));
  };

  const applyCannedResponse = (text: string) => {
    setContent(text);
    setActivePopover(null);
    textareaRef.current?.focus();
  };

  const handlePickTemplate = (template: WhatsAppTemplate) => {
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
              disabled={sendingTemplate}
              active={activePopover === "emoji"}
              onClick={() => togglePopover("emoji")}
            >
              <Smile className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              title="Adjuntar archivo"
              disabled={toolbarDisabled || sendingTemplate}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4" />
            </ToolbarButton>

            {isWhatsApp && (
              <ToolbarButton
                title="Plantillas de WhatsApp"
                disabled={toolbarDisabled || isRecording || sendingTemplate}
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
              <ComposerPopover
                title={draftTemplate ? undefined : "Plantillas de WhatsApp"}
                wide
                align="left"
              >
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
                    onConfirm={sendDraftTemplate}
                    confirmLabel={sendingTemplate ? "Enviando…" : "Enviar"}
                    busy={sendingTemplate}
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
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onInput={handleInput}
            placeholder={
              noteAboutMessage ? "Escribe una nota privada..." : "Escribe un mensaje..."
            }
            rows={1}
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none outline-none px-2 py-2.5 max-h-[120px] min-w-0"
          />

          <div className="flex items-center gap-0.5 pr-1 pb-1.5 shrink-0 relative">
            <ToolbarButton
              title="Grabar audio"
              disabled={toolbarDisabled || sendingTemplate}
              onClick={startRecording}
            >
              <Mic className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              title="Respuestas predefinidas"
              disabled={toolbarDisabled || sendingTemplate}
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
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "absolute bottom-full mb-2 z-30 bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-xl overflow-hidden animate-fade-in",
        wide ? "w-[360px]" : "w-[300px]",
        align === "left" ? "left-0" : "right-0"
      )}
    >
      {title ? (
        <div className="px-4 py-2.5 border-b border-[var(--color-border-primary)]">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            {title}
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}
