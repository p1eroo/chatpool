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
  Ban,
  ChevronDown,
} from "lucide-react";
import type { Conversation } from "@/types";
import { useAgentPermissions } from "@/hooks/useAgentPermissions";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
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
  const permissions = useAgentPermissions();
  const resolveConversation = useConversationStore((s) => s.resolveConversation);
  const reopenConversation = useConversationStore((s) => s.reopenConversation);
  const blockContact = useConversationStore((s) => s.blockContact);
  const showToast = useUIStore((s) => s.showToast);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!conversation) return null;

  const { contact, channelType } = conversation;
  const ChannelIcon = channelIcons[channelType] || Globe;

  const isResolved = conversation.status === "resolved";

  const handleBlock = async () => {
    const ok = await blockContact(conversation.id);
    setMenuOpen(false);
    showToast(ok ? `${contact.name} ha sido bloqueado` : "No se pudo bloquear el contacto");
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
        {permissions.resolveConversations &&
          (isResolved ? (
            <button
              onClick={async () => {
                const ok = await reopenConversation(conversation.id);
                if (!ok) showToast("No se pudo reabrir la conversación");
              }}
              className="h-8 px-2.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors flex items-center gap-1.5 border border-[var(--color-border-primary)]"
              title="Reabrir conversación"
            >
              Reabrir
              <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            </button>
          ) : (
            <button
              onClick={async () => {
                const ok = await resolveConversation(conversation.id);
                showToast(
                  ok ? "Conversación resuelta" : "No se pudo resolver la conversación"
                );
              }}
              className="h-8 px-2.5 text-xs font-medium text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors flex items-center gap-1.5"
              title="Resolver conversación"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Resolver
            </button>
          ))}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
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
