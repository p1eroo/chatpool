import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LabelChip } from "@/components/ui/LabelChip";
import { useInboxLabelAccentMap } from "@/hooks/useInboxLabelAccentMap";
import { cn, formatTime } from "@/lib/utils";
import { stripWhatsAppFormatting } from "@/lib/whatsappFormatting";
import { LastMessageDirectionIcon } from "@/components/conversation-list/LastMessageDirectionIcon";
import type { Conversation } from "@/types";
import {
  MessageCircle,
  Mail,
  MessageCircleMore,
  Camera,
  Globe,
} from "lucide-react";

const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  email: Mail,
  facebook: MessageCircleMore,
  instagram: Camera,
  website: Globe,
};

const channelColors: Record<string, string> = {
  whatsapp: "text-emerald-400",
  email: "text-blue-400",
  facebook: "text-blue-500",
  instagram: "text-pink-400",
  website: "text-violet-400",
};

const priorityColors = {
  urgent: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-gray-500",
  none: "bg-transparent",
};

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

export function ConversationCard({ conversation, isActive, onClick, onContextMenu }: ConversationCardProps) {
  const {
    contact,
    lastMessage,
    unreadCount,
    channelType,
    priority,
    assignee,
    isTyping,
    labels,
    status,
  } = conversation;
  const ChannelIcon = channelIcons[channelType] || Globe;
  const channelColor = channelColors[channelType] || "text-gray-400";
  const isOpen = status === "open";
  const labelAccentById = useInboxLabelAccentMap(conversation.inboxId);

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-[var(--color-border-primary)] transition-all duration-150 group",
        isActive
          ? "bg-[var(--color-brand-bg)] border-l-[3px] border-l-[var(--color-brand)]"
          : unreadCount > 0
            ? "border-l-[3px] border-l-[var(--color-warning)] bg-[var(--color-warning)]/10 hover:bg-[var(--color-warning)]/15"
            : "border-l-[3px] border-l-transparent hover:bg-[var(--color-bg-hover)]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar name={contact.name} size="md" />
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-[var(--color-bg-secondary)]",
            channelColor
          )}>
            <ChannelIcon className="w-2.5 h-2.5" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {contact.name}
              </span>
              {priority !== "none" && (
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityColors[priority])} />
              )}
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] shrink-0 ml-2">
              {lastMessage
                ? formatTime(lastMessage.createdAt)
                : formatTime(conversation.lastMessageAt ?? conversation.updatedAt)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isTyping ? (
              <p className="text-xs text-[var(--color-success)] italic flex items-center gap-1">
                <span>escribiendo</span>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-[var(--color-success)] rounded-full animate-bounce-dot" style={{ animationDelay: "0s" }} />
                  <span className="w-1 h-1 bg-[var(--color-success)] rounded-full animate-bounce-dot" style={{ animationDelay: "0.15s" }} />
                  <span className="w-1 h-1 bg-[var(--color-success)] rounded-full animate-bounce-dot" style={{ animationDelay: "0.3s" }} />
                </span>
              </p>
            ) : (
              <p
                className={cn(
                  "text-xs truncate flex-1 flex items-center gap-1 min-w-0",
                  unreadCount > 0
                    ? "text-[var(--color-text-primary)] font-medium"
                    : "text-[var(--color-text-secondary)]"
                )}
              >
                {lastMessage && !lastMessage.isPrivate && (
                  <LastMessageDirectionIcon message={lastMessage} />
                )}
                <span className="truncate">
                  {lastMessage
                    ? lastMessage.isPrivate
                      ? "📝 Nota privada"
                      : stripWhatsAppFormatting(lastMessage.content)
                    : "Sin mensajes"}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            {labels.length > 0 && (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {labels.slice(0, 2).map((label) => (
                  <LabelChip
                    key={label.id}
                    label={label}
                    accentColor={labelAccentById[label.id]}
                    size="sm"
                  />
                ))}
                {labels.length > 2 && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    +{labels.length - 2}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              {lastMessage?.senderType === "bot" && !lastMessage.isPrivate && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300">
                  Bot
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded",
                  isOpen
                    ? "bg-[var(--control-selected-bg)] text-[var(--control-selected-fg)]"
                    : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
                )}
              >
                {isOpen ? "Abierta" : "Cerrada"}
              </span>
              {assignee ? (
                <Avatar name={assignee.name} size="xs" className="!h-5 !w-5 text-[9px]" />
              ) : (
                <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded">
                  sin asignar
                </span>
              )}
              <Badge count={unreadCount} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
