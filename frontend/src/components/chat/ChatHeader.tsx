import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  MessageCircle,
  Mail,
  MessageCircleMore,
  Camera,
  Globe,
  MoreVertical,
  CheckCircle,
  UserPlus,
  Check,
  Ban,
} from "lucide-react";
import type { Conversation } from "@/types";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { allAgents } from "@/data/mock";
import { cn } from "@/lib/utils";

const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  email: Mail,
  facebook: MessageCircleMore,
  instagram: Camera,
  website: Globe,
};

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  facebook: "Facebook",
  instagram: "Instagram",
  website: "Web",
};

interface ChatHeaderProps {
  conversation?: Conversation;
}

export function ChatHeader({ conversation }: ChatHeaderProps) {
  const resolveConversation = useConversationStore((s) => s.resolveConversation);
  const reassignConversation = useConversationStore((s) => s.reassignConversation);
  const blockContact = useConversationStore((s) => s.blockContact);
  const showToast = useUIStore((s) => s.showToast);

  const [assignOpen, setAssignOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const assignRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) {
        setAssignOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!conversation) return null;

  const { contact, channelType, assignee } = conversation;
  const ChannelIcon = channelIcons[channelType] || Globe;

  const handleAssign = (agentId: string | undefined) => {
    reassignConversation(conversation.id, agentId);
    setAssignOpen(false);
    showToast(agentId ? "Conversación asignada" : "Conversación sin asignar");
  };

  const handleBlock = () => {
    blockContact(conversation.id);
    setMenuOpen(false);
    showToast(`${contact.name} ha sido bloqueado`);
  };

  return (
    <div className="h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-primary)] flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar name={contact.name} size="md" />
          {contact.lastSeen && !contact.isBlocked && (
            <StatusDot status="online" className="absolute -bottom-0.5 -right-0.5" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {contact.name}
            </h2>
            {contact.isBlocked && (
              <span className="text-[10px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                Bloqueado
              </span>
            )}
            <span className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <ChannelIcon className="w-3 h-3" />
              {channelLabels[channelType]}
            </span>
          </div>
          {contact.isBlocked ? (
            <p className="text-[11px] text-red-400/80">Contacto bloqueado</p>
          ) : contact.lastSeen ? (
            <p className="text-[11px] text-[var(--color-success)]">En línea</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative" ref={assignRef}>
          <button
            onClick={() => {
              setAssignOpen(!assignOpen);
              setMenuOpen(false);
            }}
            className={cn(
              "h-8 px-2.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border",
              assignOpen
                ? "text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] border-[var(--color-border-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] border-[var(--color-border-primary)]"
            )}
            title="Asignar agente"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {assignee ? assignee.name.split(" ")[0] : "Asignar"}
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
                {!assignee && (
                  <Check className="w-3.5 h-3.5 shrink-0 text-[var(--color-brand)]" />
                )}
              </button>
              {allAgents.map((agent) => {
                const isSelected = assignee?.id === agent.id;
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

        <button
          onClick={() => resolveConversation(conversation.id)}
          className="h-8 px-2.5 text-xs font-medium text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors flex items-center gap-1.5"
          title="Resolver conversación"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Resolver
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              setMenuOpen(!menuOpen);
              setAssignOpen(false);
            }}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
              menuOpen
                ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
            )}
            title="Más opciones"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              <button
                type="button"
                onClick={handleBlock}
                disabled={contact.isBlocked}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Ban className="w-4 h-4 shrink-0" />
                <span>{contact.isBlocked ? "Contacto bloqueado" : "Bloquear contacto"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
