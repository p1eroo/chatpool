import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { getClipboardAttachmentFile, mergePendingAttachments } from "@/lib/attachmentUtils";
import { ComposerPendingAttachments, type ComposerPendingAttachment } from "@/components/chat/ComposerPendingAttachments";
import { LinkPreviewCard } from "@/components/chat/LinkPreviewCard";
import { useLinkPreview } from "@/hooks/useLinkPreview";
import { cn } from "@/lib/utils";
import { VoiceRecorderBar } from "@/components/chat/VoiceRecorderBar";
import { ComposerEmojiPicker } from "@/components/chat/ComposerEmojiPicker";
import { CannedResponsesModal } from "@/components/chat/CannedResponsesModal";
import { CannedSlashMenu } from "@/components/chat/CannedSlashMenu";
import { WhatsAppTemplateList } from "@/components/chat/WhatsAppTemplateList";
import { WhatsAppTemplateParamForm } from "@/components/chat/WhatsAppTemplateParamForm";
import { StickerPickerPopover } from "@/components/chat/StickerPickerPopover";
import { useCannedResponses } from "@/hooks/useCannedResponses";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { filterCannedBySlashQuery, getSlashQuery } from "@/lib/cannedSlash";
import { cannedResponseApiService } from "@/services/cannedResponseApiService";
import {
  clipboardToWhatsApp,
  hasMeaningfulHtmlFormatting,
  insertClipboardWhatsAppIntoTextarea,
} from "@/lib/htmlToWhatsApp";
import { normalizeMarkdownToWhatsApp } from "@/lib/normalizeMarkdownToWhatsApp";
import { voiceFileFromBlob } from "@/lib/voiceRecording";
import { formatVoiceTime, type VoiceRecordingResult } from "@/hooks/useVoiceRecorder";
import type { WhatsAppTemplate } from "@/types/whatsappTemplate";
import { buildTemplatePreviewContent } from "@/types/whatsappTemplate";
import type { CannedResponse, SavedSticker } from "@/types";
import { contactHasPhone } from "@/lib/whatsappContactInfo";
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
  Sticker,
  Plus,
  Phone,
} from "lucide-react";

interface PendingAttachment extends ComposerPendingAttachment {}

function createPendingAttachment(file: File): PendingAttachment {
  return {
    id: `pending-file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
    url: URL.createObjectURL(file),
  };
}

type PopoverId = "emoji" | "template" | "sticker" | null;

export function ChatComposer() {
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const sendTemplateMessage = useConversationStore((s) => s.sendTemplateMessage);
  const sendSavedSticker = useConversationStore((s) => s.sendSavedSticker);
  const requestContactInfo = useConversationStore((s) => s.requestContactInfo);
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [cannedModalOpen, setCannedModalOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [draftTemplate, setDraftTemplate] = useState<WhatsAppTemplate | null>(null);
  const [draftBodyParameters, setDraftBodyParameters] = useState<string[]>([]);
  const [draftHeaderParameters, setDraftHeaderParameters] = useState<string[]>([]);
  const [draftButtonUrlParameters, setDraftButtonUrlParameters] = useState<Record<number, string>>(
    {}
  );
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [slashCursor, setSlashCursor] = useState(0);
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const [slashMenuDismissed, setSlashMenuDismissed] = useState(false);

  const activeInboxId = activeConversation?.inboxId ?? null;
  const { data: cannedResponses = [] } = useCannedResponses(activeInboxId);
  const {
    preview: composerLinkPreview,
    loading: composerLinkPreviewLoading,
    dismiss: dismissComposerLinkPreview,
    isDismissed: composerLinkPreviewDismissed,
    url: composerLinkUrl,
  } = useLinkPreview(
    content,
    !noteAboutMessage && pendingAttachments.length === 0 && !isRecording
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);

  pendingAttachmentsRef.current = pendingAttachments;

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
    setMoreOpen(false);
    setCannedModalOpen(false);
    setIsRecording(false);
    setSlashCursor(0);
    setSlashActiveIndex(0);
    setSlashMenuDismissed(false);
    revokePendingAttachments(pendingAttachmentsRef.current);
    setPendingAttachments([]);
  }, [activeConversationId, setReplyToMessage, setNoteAboutMessage]);

  useEffect(() => {
    return () => {
      revokePendingAttachments(pendingAttachmentsRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setActivePopover(null);
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function revokePendingAttachments(items: PendingAttachment[]) {
    for (const item of items) {
      if (item.url) URL.revokeObjectURL(item.url);
    }
  }

  const stageFiles = useCallback(
    (files: File[]) => {
      if (!activeConversationId || files.length === 0) return false;
      if (noteAboutMessage) return false;

      const currentFiles = pendingAttachmentsRef.current.map((item) => item.file);
      const result = mergePendingAttachments(currentFiles, files);

      if (!result.ok) {
        showToast(result.reason);
        return false;
      }

      if (result.truncated) {
        showToast(`Solo se adjuntaron ${result.files.length} imágenes (máximo por envío)`);
      }

      setPendingAttachments((prev) => {
        revokePendingAttachments(prev);
        return result.files.map(createPendingAttachment);
      });
      setActivePopover(null);
      textareaRef.current?.focus();
      return true;
    },
    [activeConversationId, noteAboutMessage, showToast]
  );

  const stageFile = useCallback(
    (file: File) => stageFiles([file]),
    [stageFiles]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const file = getClipboardAttachmentFile(e.clipboardData);
      if (file) {
        e.preventDefault();

        if (noteAboutMessage) {
          showToast("No puedes adjuntar archivos en una nota privada");
          return;
        }
        if (!stageFile(file)) {
          showToast("Tipo de archivo no soportado");
        }
        return;
      }

      const data = e.clipboardData;
      const html = data.getData("text/html");
      const plain = data.getData("text/plain");
      if (!html?.trim() && !plain?.trim()) return;

      // Solo interceptamos si hay formato HTML real o markdown que convertir.
      const shouldConvert =
        (Boolean(html?.trim()) && hasMeaningfulHtmlFormatting(html)) ||
        /\*\*|__|~~|^[\t ]*[-*] /m.test(plain);
      if (!shouldConvert) return;

      const converted = clipboardToWhatsApp(data);
      if (!converted) return;

      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const next = insertClipboardWhatsAppIntoTextarea(el, data, content);
      setContent(next);
      setSlashCursor(start + converted.length);
      setSlashMenuDismissed(false);

      requestAnimationFrame(() => {
        el.focus();
        const pos = start + converted.length;
        el.setSelectionRange(pos, pos);
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
      });
    },
    [noteAboutMessage, stageFile, showToast, content]
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
    const attachments = pendingAttachments;

    if (attachments.length > 0) {
      const replyId = replyToMessage?.id;

      attachments.forEach((attachment, index) => {
        const { file } = attachment;
        const isImage = file.type.startsWith("image/");

        sendMessage(
          activeConversationId,
          index === 0 ? caption || file.name : file.name,
          false,
          {
            replyToMessageId: index === 0 ? replyId : undefined,
            contentType: isImage ? "image" : "file",
            fileName: file.name,
            fileSize: file.size,
            file,
          }
        );
      });

      revokePendingAttachments(attachments);
      setPendingAttachments([]);
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
      linkPreview:
        composerLinkPreviewDismissed ? undefined : composerLinkPreview ?? undefined,
      suppressLinkPreview: composerLinkPreviewDismissed && Boolean(composerLinkUrl),
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
    pendingAttachments,
    sendMessage,
    sendingTemplate,
    setReplyToMessage,
    setNoteAboutMessage,
    composerLinkPreview,
    composerLinkPreviewDismissed,
    composerLinkUrl,
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
        if (!ok) return;
        setDraftTemplate(null);
        setActivePopover(null);
        setReplyToMessage(null);
        setNoteAboutMessage(null);
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

  const slashQuery = useMemo(
    () => (slashMenuDismissed ? null : getSlashQuery(content, slashCursor)),
    [content, slashCursor, slashMenuDismissed]
  );

  const slashMatches = useMemo(
    () =>
      slashQuery
        ? filterCannedBySlashQuery(cannedResponses, slashQuery.query)
        : [],
    [cannedResponses, slashQuery]
  );

  const slashMenuOpen = Boolean(slashQuery);

  useEffect(() => {
    setSlashActiveIndex(0);
  }, [slashQuery?.query, slashQuery?.start]);

  const applySlashResponse = useCallback(
    (item: CannedResponse) => {
      const query = getSlashQuery(
        content,
        textareaRef.current?.selectionStart ?? slashCursor
      );
      if (!query) return;

      const inserted = normalizeMarkdownToWhatsApp(item.content);
      const next = content.slice(0, query.start) + inserted + content.slice(query.end);
      setContent(next);
      setSlashMenuDismissed(true);
      setSlashActiveIndex(0);

      if (item.attachmentUrl || item.fileUrl) {
        void (async () => {
          try {
            const file = await cannedResponseApiService.fetchImageFile(item);
            if (file && !stageFile(file)) {
              showToast("No se pudo adjuntar la imagen de la respuesta");
            }
          } catch {
            showToast("No se pudo cargar la imagen de la respuesta");
          }
        })();
      }

      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        const pos = query.start + inserted.length;
        el.setSelectionRange(pos, pos);
        setSlashCursor(pos);
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
      });
    },
    [content, slashCursor, stageFile, showToast]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashActiveIndex((prev) =>
          slashMatches.length ? (prev + 1) % slashMatches.length : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashActiveIndex((prev) =>
          slashMatches.length
            ? (prev - 1 + slashMatches.length) % slashMatches.length
            : 0
        );
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setSlashMenuDismissed(true);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const selected = slashMatches[slashActiveIndex];
        if (selected) applySlashResponse(selected);
        return;
      }
      if (e.key === "Tab" && slashMatches[slashActiveIndex]) {
        e.preventDefault();
        applySlashResponse(slashMatches[slashActiveIndex]);
        return;
      }
    }

    // Como WhatsApp Web: Esc cierra el detalle del chat (aunque el foco esté en el composer).
    if (e.key === "Escape") {
      e.preventDefault();
      useConversationStore.getState().selectConversation(null);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleContentChange = (value: string, cursor: number) => {
    setContent(value);
    setSlashCursor(cursor);
    setSlashMenuDismissed(false);
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
    setMoreOpen(false);
    setIsRecording(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (!stageFiles(files)) {
      showToast("No se puede adjuntar este archivo");
    }

    e.target.value = "";
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return prev.filter((item) => item.id !== id);
    });
  };

  const openAddImages = () => {
    fileInputRef.current?.click();
  };

  const canSend = !sendingTemplate && Boolean(content.trim() || pendingAttachments.length > 0);

  const togglePopover = (id: PopoverId) => {
    setMoreOpen(false);
    setActivePopover((prev) => (prev === id ? null : id));
  };

  const toggleMore = () => {
    setActivePopover(null);
    setDraftTemplate(null);
    setMoreOpen((prev) => !prev);
  };

  const openFromMore = (id: Exclude<PopoverId, "emoji" | null>) => {
    setMoreOpen(false);
    setActivePopover(id);
  };

  const openCannedModal = () => {
    setMoreOpen(false);
    setActivePopover(null);
    setCannedModalOpen(true);
  };

  const applyCannedResponse = async (response: CannedResponse) => {
    const text = normalizeMarkdownToWhatsApp(response.content);
    setContent(text);
    setCannedModalOpen(false);
    setSlashMenuDismissed(true);

    if (response.attachmentUrl || response.fileUrl) {
      try {
        const file = await cannedResponseApiService.fetchImageFile(response);
        if (file && !stageFile(file)) {
          showToast("No se pudo adjuntar la imagen de la respuesta");
        }
      } catch {
        showToast("No se pudo cargar la imagen de la respuesta");
      }
    }

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

  const handleSendSticker = (sticker: SavedSticker) => {
    if (!activeConversationId) return;
    setActivePopover(null);
    void sendSavedSticker(activeConversationId, sticker);
  };

  const toolbarDisabled = isRecording;

  return (
    <div
      ref={composerRef}
      className={cn(
        "border-t border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
        noteAboutMessage && "border-t-amber-500/30"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileChange}
      />

      {!isRecording && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            moreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
          aria-hidden={!moreOpen}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className={cn(
                "origin-bottom transition-[opacity,transform] duration-300 ease-out",
                moreOpen
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none"
              )}
            >
              <ComposerMoreTray
                isWhatsApp={isWhatsApp}
                showRequestPhone={
                  isWhatsApp && !contactHasPhone(activeConversation?.contact.phone)
                }
                disabled={!moreOpen || toolbarDisabled || sendingTemplate}
                onAudio={startRecording}
                onFiles={() => {
                  setMoreOpen(false);
                  fileInputRef.current?.click();
                }}
                onTemplates={() => {
                  setDraftTemplate(null);
                  openFromMore("template");
                }}
                onCanned={openCannedModal}
                onRequestPhone={() => {
                  if (!activeConversationId) return;
                  setMoreOpen(false);
                  void requestContactInfo(activeConversationId);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <CannedResponsesModal
        open={cannedModalOpen}
        inboxId={activeInboxId}
        onClose={() => setCannedModalOpen(false)}
        onSelect={applyCannedResponse}
      />

      <div className="p-3">
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

      {(composerLinkPreview || composerLinkPreviewLoading) && composerLinkUrl ? (
        <LinkPreviewCard
          preview={composerLinkPreview ?? { url: composerLinkUrl }}
          variant="composer"
          loading={composerLinkPreviewLoading}
          onDismiss={dismissComposerLinkPreview}
        />
      ) : null}

      {pendingAttachments.length > 0 && !isRecording && (
        <ComposerPendingAttachments
          attachments={pendingAttachments}
          onRemove={removePendingAttachment}
          onAddImages={openAddImages}
        />
      )}

      {isRecording ? (
        <VoiceRecorderBar
          onSend={handleVoiceSend}
          onCancel={() => setIsRecording(false)}
          onError={(message) => showToast(message)}
        />
      ) : (
        <div className="relative">
          <div className="relative flex items-center gap-2">
            <div className="flex items-center gap-1 shrink-0 relative">
              <ToolbarButton
                title={moreOpen ? "Cerrar opciones" : "Más opciones"}
                disabled={sendingTemplate}
                active={moreOpen}
                onClick={toggleMore}
              >
                <Plus
                  className={cn(
                    "w-5 h-5 transition-transform duration-300 ease-out",
                    moreOpen && "rotate-45"
                  )}
                />
              </ToolbarButton>

              <ToolbarButton
                title="Emoji"
                disabled={sendingTemplate}
                active={activePopover === "emoji"}
                onClick={() => togglePopover("emoji")}
              >
                <Smile className="w-5 h-5" />
              </ToolbarButton>

              {isWhatsApp && (
                <ToolbarButton
                  title="Stickers"
                  disabled={sendingTemplate}
                  active={activePopover === "sticker"}
                  onClick={() => togglePopover("sticker")}
                >
                  <Sticker className="w-5 h-5" />
                </ToolbarButton>
              )}

              {activePopover === "emoji" && (
                <ComposerEmojiPicker
                  align="left"
                  onEmojiSelect={(emoji) => insertAtCursor(emoji)}
                />
              )}

              {activePopover === "sticker" && (
                <StickerPickerPopover onSelect={handleSendSticker} disabled={sendingTemplate} />
              )}
            </div>

            <div className="relative flex-1 min-w-0 flex items-center min-h-10 bg-[var(--color-bg-tertiary)] rounded-2xl border border-transparent focus-within:border-[var(--color-brand)] transition-colors">
              {slashMenuOpen && (
                <CannedSlashMenu
                  items={slashMatches}
                  activeIndex={Math.min(
                    slashActiveIndex,
                    Math.max(slashMatches.length - 1, 0)
                  )}
                  onHover={setSlashActiveIndex}
                  onSelect={applySlashResponse}
                />
              )}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) =>
                  handleContentChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
                }
                onClick={(e) => setSlashCursor(e.currentTarget.selectionStart ?? 0)}
                onKeyUp={(e) => setSlashCursor(e.currentTarget.selectionStart ?? 0)}
                onSelect={(e) => setSlashCursor(e.currentTarget.selectionStart ?? 0)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onInput={handleInput}
                placeholder={
                  noteAboutMessage
                    ? "Escribe una nota privada..."
                    : "Escribe un mensaje… o / para respuestas"
                }
                rows={1}
                className="w-full bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none outline-none px-4 py-2.5 max-h-[120px] leading-5"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                title={
                  pendingAttachments.length > 1
                    ? `Enviar ${pendingAttachments.length} imágenes`
                    : "Enviar mensaje"
                }
                className={cn(
                  "relative w-10 h-10 flex items-center justify-center rounded-xl text-white transition-all shrink-0",
                  !canSend
                    ? "bg-[var(--color-brand)]/40 cursor-not-allowed"
                    : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] active:scale-95"
                )}
              >
                <Send className="w-5 h-5" />
                {pendingAttachments.length > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[10px] font-bold leading-[18px] text-[var(--color-brand)] shadow-sm">
                    {pendingAttachments.length}
                  </span>
                )}
              </button>
            </div>

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
        </div>
      )}
      </div>
    </div>
  );
}

function ComposerMoreTray({
  isWhatsApp,
  showRequestPhone,
  disabled,
  onAudio,
  onFiles,
  onTemplates,
  onCanned,
  onRequestPhone,
}: {
  isWhatsApp: boolean;
  showRequestPhone?: boolean;
  disabled?: boolean;
  onAudio: () => void;
  onFiles: () => void;
  onTemplates: () => void;
  onCanned: () => void;
  onRequestPhone: () => void;
}) {
  const items = [
    {
      id: "audio",
      label: "Audio",
      icon: Mic,
      onClick: onAudio,
      iconClass: "text-rose-400",
    },
    {
      id: "files",
      label: "Archivos",
      icon: Paperclip,
      onClick: onFiles,
      iconClass: "text-sky-400",
    },
    ...(isWhatsApp
      ? [
          {
            id: "templates",
            label: "Plantilla",
            icon: MessageSquare,
            onClick: onTemplates,
            iconClass: "text-emerald-400",
          },
        ]
      : []),
    ...(showRequestPhone
      ? [
          {
            id: "request-phone",
            label: "Pedir número",
            icon: Phone,
            onClick: onRequestPhone,
            iconClass: "text-amber-400",
          },
        ]
      : []),
    {
      id: "canned",
      label: "Respuestas",
      icon: Zap,
      onClick: onCanned,
      iconClass: "text-violet-400",
    },
  ] as const;

  return (
    <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 py-4">
      <div className="flex items-stretch justify-evenly">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={item.onClick}
              className={cn(
                "flex flex-col items-center gap-2 px-3 py-1 rounded-lg transition-colors min-w-0",
                disabled
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-[var(--color-bg-hover)]"
              )}
            >
              <span className="w-12 h-12 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                <Icon className={cn("w-5 h-5", item.iconClass)} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
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
        "w-10 h-10 flex items-center justify-center rounded-xl transition-colors",
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
