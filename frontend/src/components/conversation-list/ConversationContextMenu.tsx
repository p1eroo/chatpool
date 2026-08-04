import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Mail,
  RotateCcw,
  Check,
  Tag,
  UserPlus,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useAgentPermissions } from "@/hooks/useAgentPermissions";
import { useConversationStore } from "@/store/conversationStore";
import { useLabelStore } from "@/store/labelStore";
import { useAgentStore } from "@/store/agentStore";
import { LabelColorDot } from "@/components/settings/LabelColorDot";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

type SubmenuId = "labels" | "agents";

interface ConversationContextMenuProps {
  conversation: Conversation;
  x: number;
  y: number;
  onClose: () => void;
}

interface MenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  hasSubmenu?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  { icon: Icon, label, onClick, onMouseEnter, hasSubmenu, destructive, disabled },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        destructive
          ? "text-red-400 hover:bg-red-500/10"
          : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
      )}
    >
      <Icon className="w-4 h-4 shrink-0 text-[var(--color-text-secondary)]" />
      <span className="flex-1 truncate">{label}</span>
      {hasSubmenu && (
        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" />
      )}
    </button>
  );
});

export function ConversationContextMenu({
  conversation,
  x,
  y,
  onClose,
}: ConversationContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const labelItemRef = useRef<HTMLButtonElement>(null);
  const agentItemRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId | null>(null);
  const [submenuStyle, setSubmenuStyle] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const permissions = useAgentPermissions();
  const resolveConversation = useConversationStore((s) => s.resolveConversation);
  const reopenConversation = useConversationStore((s) => s.reopenConversation);
  const markAsUnread = useConversationStore((s) => s.markAsUnread);
  const toggleConversationLabel = useConversationStore((s) => s.toggleConversationLabel);
  const reassignConversation = useConversationStore((s) => s.reassignConversation);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const allAgents = useAgentStore((s) => s.agents);
  const agents = useMemo(
    () => allAgents.filter((agent) => agent.active !== false),
    [allAgents]
  );
  const getLabelsForInbox = useLabelStore((s) => s.getLabelsForInbox);
  const inboxLabels = getLabelsForInbox(conversation.inboxId);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const padding = 8;
    let nextX = x;
    let nextY = y;

    if (nextX + rect.width > window.innerWidth - padding) {
      nextX = window.innerWidth - rect.width - padding;
    }
    if (nextY + rect.height > window.innerHeight - padding) {
      nextY = window.innerHeight - rect.height - padding;
    }

    nextX = Math.max(padding, nextX);
    nextY = Math.max(padding, nextY);

    setPosition({ x: nextX, y: nextY });
  }, [x, y, activeSubmenu]);

  useLayoutEffect(() => {
    if (!activeSubmenu || !menuRef.current) return;

    const itemRef = activeSubmenu === "labels" ? labelItemRef : agentItemRef;

    const item = itemRef.current;
    const menu = menuRef.current;
    if (!item) return;

    const menuRect = menu.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const padding = 8;
    const submenuWidth = 220;
    const openRight = menuRect.right + submenuWidth <= window.innerWidth - padding;

    setSubmenuStyle({
      top: itemRect.top - menuRect.top,
      left: openRight ? menuRect.width + 4 : -submenuWidth - 4,
    });
  }, [activeSubmenu, position]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onClose]);

  const runAction = (action: () => void | Promise<unknown>) => {
    void action();
    onClose();
  };

  const submenuClassName =
    "absolute min-w-[200px] max-h-[280px] overflow-y-auto rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] py-1 shadow-xl";

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[220px] rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] py-1 shadow-xl animate-fade-in"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => setActiveSubmenu(null)}
    >
      <MenuItem
        icon={Mail}
        label="Marcar como no leído"
        disabled={conversation.unreadCount > 0}
        onClick={() => runAction(() => markAsUnread(conversation.id))}
      />

      <div className="my-1 h-px bg-[var(--color-border-primary)]" />

      {permissions.resolveConversations && (
        <>
          <MenuItem
            icon={Check}
            label="Marcar como resuelto"
            disabled={conversation.status === "resolved"}
            onClick={() => runAction(() => resolveConversation(conversation.id))}
          />

          <MenuItem
            icon={RotateCcw}
            label="Reabrir conversación"
            disabled={conversation.status === "open"}
            onClick={() => runAction(() => reopenConversation(conversation.id))}
          />
        </>
      )}

      {(permissions.manageLabels || permissions.assignConversations) && (
        <div className="my-1 h-px bg-[var(--color-border-primary)]" />
      )}

      {permissions.manageLabels && (
        <MenuItem
          ref={labelItemRef}
          icon={Tag}
          label="Asignar etiqueta"
          hasSubmenu
          onMouseEnter={() => setActiveSubmenu("labels")}
        />
      )}
      {permissions.assignConversations && (
        <MenuItem
          ref={agentItemRef}
          icon={UserPlus}
          label="Asignar un agente"
          hasSubmenu
          onMouseEnter={() => setActiveSubmenu("agents")}
        />
      )}

      {permissions.deleteConversations && (
        <>
          <div className="my-1 h-px bg-[var(--color-border-primary)]" />
          <MenuItem
            icon={Trash2}
            label="Eliminar conversación"
            destructive
            onClick={() => runAction(() => deleteConversation(conversation.id))}
          />
        </>
      )}

      {activeSubmenu === "labels" && permissions.manageLabels && (
        <div className={submenuClassName} style={submenuStyle}>
          {inboxLabels.map((label) => {
            const isSelected = conversation.labels.some((l) => l.id === label.id);
            return (
              <button
                key={label.id}
                type="button"
                onClick={() =>
                  runAction(() => toggleConversationLabel(conversation.id, label.id))
                }
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <LabelColorDot color={label.color} className="w-2.5 h-2.5" />
                <span className="flex-1 truncate">{label.name}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 shrink-0 text-[var(--color-brand)]" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeSubmenu === "agents" && permissions.assignConversations && (
        <div className={cn(submenuClassName, "min-w-[220px] max-h-[320px]")} style={submenuStyle}>
          <button
            type="button"
            onClick={() => runAction(() => reassignConversation(conversation.id, undefined))}
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
                onClick={() =>
                  runAction(() => reassignConversation(conversation.id, agent.id))
                }
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
    </div>,
    document.body
  );
}
