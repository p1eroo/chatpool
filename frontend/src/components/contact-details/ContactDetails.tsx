import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { Avatar, getAvatarColorClass, getAvatarInitials, isImageUrl } from "@/components/ui/Avatar";
import { LabelColorDot } from "@/components/settings/LabelColorDot";
import { useAgentStore } from "@/store/agentStore";
import { useLabelStore } from "@/store/labelStore";
import {
  downloadMessageFile,
  getConversationFiles,
  getConversationImages,
} from "@/lib/conversationAttachments";
import { getFileTypeBadgeStyle, splitFileName } from "@/lib/fileUtils";
import { cn, formatFileSize } from "@/lib/utils";
import type { Message } from "@/types";
import {
  PanelRightClose,
  Phone,
  Download,
  ExternalLink,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import type { Conversation, ConversationStatus } from "@/types";

const EMPTY_MESSAGES: Message[] = [];

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp Business",
  email: "Correo Electrónico",
  facebook: "Facebook Messenger",
  instagram: "Instagram DM",
  website: "Chat Web",
};

const statusLabels: Record<ConversationStatus, string> = {
  open: "Abierto",
  resolved: "Resuelto",
};

const statusOptions: ConversationStatus[] = ["open", "resolved"];

export function ContactDetails() {
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const conversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );
  const { contactSidebarOpen, setContactSidebarOpen } = useUIStore();

  if (!contactSidebarOpen) {
    return (
      <button
        onClick={() => setContactSidebarOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors absolute right-3 top-3 z-10"
        title="Abrir panel de contacto"
      >
        <PanelRightClose className="w-4 h-4 rotate-180" />
      </button>
    );
  }

  if (!conversation) {
    return (
      <aside className="w-[340px] bg-[var(--color-bg-secondary)] border-l border-[var(--color-border-primary)] flex flex-col shrink-0 h-screen overflow-y-auto animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-primary)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Detalles</h3>
          <button
            onClick={() => setContactSidebarOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Selecciona una conversación para ver los detalles del contacto
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] bg-[var(--color-bg-secondary)] border-l border-[var(--color-border-primary)] flex flex-col shrink-0 h-screen overflow-y-auto animate-slide-in-right">
      <ContactHero
        conversation={conversation}
        onClose={() => setContactSidebarOpen(false)}
      />
      <ContactSummary conversation={conversation} />
      <MediaSection conversationId={conversation.id} />
      <FilesSection conversationId={conversation.id} />
    </aside>
  );
}

function ContactHero({
  conversation,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const { contact } = conversation;
  const photoUrl = isImageUrl(contact.avatar) ? contact.avatar : null;
  const initials = getAvatarInitials(contact.name);
  const avatarColorClass = getAvatarColorClass(contact.name);

  return (
    <div className="relative h-52 shrink-0 overflow-hidden">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={contact.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            avatarColorClass
          )}
        >
          <span className="text-7xl font-semibold text-white/90 select-none">
            {initials}
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/50 transition-colors backdrop-blur-sm"
        title="Cerrar panel"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-lg font-semibold text-white mb-1">{contact.name}</h3>
        <div className="flex items-center gap-2">
          {contact.isBlocked ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-sm text-red-200">Bloqueado</span>
            </>
          ) : contact.lastSeen ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
              <span className="text-sm text-white/80">En línea</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />
              <span className="text-sm text-white/70">Desconectado</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactSummary({ conversation }: { conversation: Conversation }) {
  const { contact } = conversation;
  const reassignConversation = useConversationStore((s) => s.reassignConversation);
  const setConversationStatus = useConversationStore((s) => s.setConversationStatus);
  const toggleConversationLabel = useConversationStore((s) => s.toggleConversationLabel);
  const showToast = useUIStore((s) => s.showToast);
  const allAgents = useAgentStore((s) => s.agents);
  const labels = useLabelStore((s) => s.labels);
  const agents = useMemo(
    () => allAgents.filter((agent) => agent.active !== false),
    [allAgents]
  );
  const inboxLabels = useMemo(
    () => labels.filter((label) => label.inboxId === conversation.inboxId),
    [labels, conversation.inboxId]
  );

  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const assignRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) {
        setAssignOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
      if (labelsRef.current && !labelsRef.current.contains(e.target as Node)) {
        setLabelsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAssign = (agentId: string | undefined) => {
    reassignConversation(conversation.id, agentId);
    setAssignOpen(false);
    showToast(agentId ? "Agente actualizado" : "Conversación sin asignar");
  };

  const handleStatusChange = (status: ConversationStatus) => {
    setConversationStatus(conversation.id, status);
    setStatusOpen(false);
    showToast("Estado actualizado");
  };

  return (
    <div className="px-4 py-4 border-b border-[var(--color-border-primary)] space-y-3">
      {contact.phone && (
        <div className="flex items-center gap-2.5 text-[13px] text-[var(--color-text-secondary)]">
          <Phone className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
          <span>{contact.phone}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-[var(--color-text-muted)]">Canal</span>
        <span className="text-[var(--color-text-primary)]">
          {channelLabels[conversation.channelType] || conversation.channelType}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-[var(--color-text-muted)] shrink-0">Agente</span>
        <div className="relative min-w-0" ref={assignRef}>
          <button
            type="button"
            onClick={() => setAssignOpen(!assignOpen)}
            className={cn(
              "flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 -mr-2 transition-colors",
              assignOpen
                ? "bg-[var(--color-bg-tertiary)]"
                : "hover:bg-[var(--color-bg-tertiary)]"
            )}
          >
            {conversation.assignee ? (
              <>
                <Avatar name={conversation.assignee.name} size="sm" />
                <span className="text-[var(--color-text-primary)] truncate">
                  {conversation.assignee.name}
                </span>
              </>
            ) : (
              <span className="text-[var(--color-text-secondary)]">Sin asignar</span>
            )}
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform",
                assignOpen && "rotate-180"
              )}
            />
          </button>

          {assignOpen && (
            <div className="absolute top-full right-0 mt-1 w-56 max-h-72 overflow-y-auto bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              <button
                type="button"
                onClick={() => handleAssign(undefined)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <Avatar name="N" size="sm" />
                <span className="flex-1 truncate">Ninguno</span>
                {!conversation.assignee && (
                  <Check className="w-3.5 h-3.5 shrink-0 text-[var(--color-brand)]" />
                )}
              </button>
              {agents.map((agent) => {
                const isSelected = conversation.assignee?.id === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleAssign(agent.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                  >
                    <Avatar name={agent.name} size="sm" />
                    <span className="flex-1 truncate">{agent.name}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0 text-[var(--color-brand)]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-[var(--color-text-muted)] shrink-0">Estado</span>
        <div className="relative min-w-0" ref={statusRef}>
          <button
            type="button"
            onClick={() => setStatusOpen(!statusOpen)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 -mr-2 transition-colors",
              statusOpen
                ? "bg-[var(--color-bg-tertiary)]"
                : "hover:bg-[var(--color-bg-tertiary)]"
            )}
          >
            <span className="text-[var(--color-text-primary)]">
              {statusLabels[conversation.status]}
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform",
                statusOpen && "rotate-180"
              )}
            />
          </button>

          {statusOpen && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              {statusOptions.map((status) => {
                const isSelected = conversation.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(status)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                  >
                    <span className="flex-1 truncate">{statusLabels[status]}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0 text-[var(--color-brand)]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 text-[13px]">
        <span className="text-[var(--color-text-muted)] shrink-0 pt-1">Etiquetas</span>
        <div className="relative flex flex-wrap justify-end gap-1.5 min-w-0 max-w-[220px]" ref={labelsRef}>
          {conversation.labels.map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => toggleConversationLabel(conversation.id, label.id)}
              className="text-[11px] px-2 py-1 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] flex items-center gap-1 hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <LabelColorDot color={label.color} className="w-1.5 h-1.5" />
              {label.name}
            </button>
          ))}

          {conversation.labels.length < inboxLabels.length && (
            <>
              <button
                type="button"
                onClick={() => setLabelsOpen(!labelsOpen)}
                className="text-[11px] px-2 py-1 rounded-full border border-dashed border-[var(--color-border-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-colors"
              >
                + Añadir
              </button>

              {labelsOpen && (
                <div className="absolute top-full right-0 mt-1 w-44 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg shadow-xl z-50 py-1 animate-fade-in">
                  {inboxLabels
                    .filter((label) => !conversation.labels.some((l) => l.id === label.id))
                    .map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => {
                          toggleConversationLabel(conversation.id, label.id);
                          setLabelsOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <LabelColorDot color={label.color} className="w-2 h-2" />
                        <span className="truncate">{label.name}</span>
                      </button>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaSection({ conversationId }: { conversationId: string }) {
  const messages = useConversationStore(
    (s) => s.messages[conversationId] ?? EMPTY_MESSAGES
  );
  const openLightbox = useUIStore((s) => s.openLightbox);
  const [showAll, setShowAll] = useState(false);

  const images = useMemo(() => getConversationImages(messages), [messages]);
  const previewCount = 4;
  const visibleImages = showAll ? images : images.slice(0, previewCount);
  const remainingCount = Math.max(0, images.length - previewCount);

  if (images.length === 0) {
    return (
      <section className="px-4 py-4 border-b border-[var(--color-border-primary)]">
        <SectionLabel className="mb-2">Media</SectionLabel>
        <p className="text-xs text-[var(--color-text-muted)]">
          No hay imágenes en esta conversación
        </p>
      </section>
    );
  }

  return (
    <section className="px-4 py-4 border-b border-[var(--color-border-primary)]">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Media ({images.length})</SectionLabel>
        {images.length > previewCount && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="text-xs font-medium text-[var(--color-brand)] hover:opacity-80 transition-opacity"
          >
            {showAll ? "Ver menos" : "Ver todo"}
          </button>
        )}
      </div>

      <div className={cn("grid gap-2", showAll ? "grid-cols-3" : "grid-cols-4")}>
        {visibleImages.map((message, index) => {
          const isLastPreview =
            !showAll &&
            index === visibleImages.length - 1 &&
            remainingCount > 0;

          return (
            <button
              key={message.id}
              type="button"
              onClick={() => openLightbox(message.id)}
              className="relative aspect-square overflow-hidden rounded-lg bg-[var(--color-bg-tertiary)]"
              title={message.fileName || "Ver imagen"}
            >
              <img
                src={message.fileUrl}
                alt={message.fileName || ""}
                className="h-full w-full object-cover"
              />
              {isLastPreview && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
                  +{remainingCount}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FilesSection({ conversationId }: { conversationId: string }) {
  const messages = useConversationStore(
    (s) => s.messages[conversationId] ?? EMPTY_MESSAGES
  );
  const files = useMemo(() => getConversationFiles(messages), [messages]);

  return (
    <section className="px-4 py-4 border-b border-[var(--color-border-primary)]">
      <SectionLabel className="mb-3">
        Archivos{files.length > 0 ? ` (${files.length})` : ""}
      </SectionLabel>

      {files.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          No hay archivos en esta conversación
        </p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <FileRow key={file.id} message={file} />
          ))}
        </div>
      )}
    </section>
  );
}

function FileRow({ message }: { message: Message }) {
  const fileName = message.fileName || message.content || "Archivo";
  const { extension } = splitFileName(fileName);
  const badge = getFileTypeBadgeStyle(extension, false);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] px-3 py-2.5">
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold uppercase",
          badge.badge
        )}
      >
        {message.contentType === "audio" ? "AUD" : badge.label}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {fileName}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {message.fileSize !== undefined
            ? formatFileSize(message.fileSize)
            : message.contentType === "audio"
              ? "Audio"
              : "Archivo"}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => downloadMessageFile(message)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          title="Descargar"
        >
          <Download className="w-4 h-4" />
        </button>
        {message.fileUrl && (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            title="Abrir"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide",
        className
      )}
    >
      {children}
    </p>
  );
}
