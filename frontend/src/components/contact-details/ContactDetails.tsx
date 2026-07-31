import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { Avatar } from "@/components/ui/Avatar";
import {
  getContactPhotoUrl,
  getContactMedia,
  getContactFiles,
  allAgents,
  labels as allLabels,
} from "@/data/mock";
import { cn } from "@/lib/utils";
import {
  PanelRightClose,
  Phone,
  Download,
  MoreHorizontal,
  FileText,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import type { Conversation, ConversationStatus } from "@/types";

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
      <MediaSection contactId={conversation.contact.id} />
      <FilesSection contactId={conversation.contact.id} />
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
  const photoUrl = getContactPhotoUrl(contact.id);

  return (
    <div className="relative h-52 shrink-0 overflow-hidden">
      <img
        src={photoUrl}
        alt={contact.name}
        className="absolute inset-0 h-full w-full object-cover"
      />
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
              {allAgents.map((agent) => {
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
              <span className={cn("w-1.5 h-1.5 rounded-full", labelColor(label.color))} />
              {label.name}
            </button>
          ))}

          {conversation.labels.length < allLabels.length && (
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
                  {allLabels
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
                        <span className={cn("w-2 h-2 rounded-full shrink-0", labelColor(label.color))} />
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

function MediaSection({ contactId }: { contactId: string }) {
  const media = getContactMedia(contactId);
  const visibleMedia = media.slice(0, 4);
  const remainingCount = media.length - visibleMedia.length;

  return (
    <section className="px-4 py-4 border-b border-[var(--color-border-primary)]">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Media</SectionLabel>
        <button className="text-xs font-medium text-[var(--color-brand)] hover:opacity-80 transition-opacity">
          Ver todo
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {visibleMedia.map((item, index) => {
          const isLast = index === visibleMedia.length - 1 && remainingCount > 0;

          return (
            <button
              key={item.id}
              type="button"
              className="relative aspect-square overflow-hidden rounded-lg bg-[var(--color-bg-tertiary)]"
              title="Ver imagen"
            >
              <img
                src={item.url}
                alt=""
                className="h-full w-full object-cover"
              />
              {isLast && (
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

function FilesSection({ contactId }: { contactId: string }) {
  const files = getContactFiles(contactId);

  return (
    <section className="px-4 py-4 border-b border-[var(--color-border-primary)]">
      <SectionLabel className="mb-3">Archivos</SectionLabel>

      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] px-3 py-2.5"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--color-brand)]/15 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[var(--color-brand)]" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {file.name}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">{file.size}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                title="Descargar"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                title="Más opciones"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
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

function labelColor(color: string): string {
  const colors: Record<string, string> = {
    purple: "bg-purple-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
  };
  return colors[color] || "bg-gray-500";
}
