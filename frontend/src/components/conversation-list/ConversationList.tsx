import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { ConversationCard } from "./ConversationCard";
import { ConversationContextMenu } from "./ConversationContextMenu";
import { useCurrentAgent } from "@/hooks/useCurrentAgent";
import { useLabelStore } from "@/store/labelStore";
import { useInboxStore } from "@/store/inboxStore";
import {
  Search,
  MessageCircle,
  Tag,
} from "lucide-react";
import type { AssigneeFilter } from "@/store/conversationStore";
import type { Conversation } from "@/types";
import { LabelColorDot } from "@/components/settings/LabelColorDot";
import { cn } from "@/lib/utils";

const assigneeTabs = [
  { id: "mine", label: "Mías" },
  { id: "unassigned", label: "Sin asignar" },
  { id: "all", label: "Todos" },
] as const;

const statusTabs = [
  { id: "open", label: "Abiertos" },
  { id: "resolved", label: "Resueltos" },
  { id: "all", label: "Todos" },
];

function matchesAssignee(conversation: Conversation, assignee: AssigneeFilter, currentAgentId?: string) {
  if (assignee === "mine") return Boolean(currentAgentId && conversation.assignee?.id === currentAgentId);
  if (assignee === "unassigned") return !conversation.assignee;
  return true;
}

function matchesStatus(conversation: Conversation, status: string) {
  if (status === "all") return true;
  return conversation.status === status;
}

export function ConversationList() {
  const currentAgent = useCurrentAgent();
  const getLabelsForInbox = useLabelStore((s) => s.getLabelsForInbox);
  const conversations = useConversationStore((s) => s.conversations);
  const inboxes = useInboxStore((s) => s.inboxes);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const filterStatus = useConversationStore((s) => s.filterStatus);
  const filterAssignee = useConversationStore((s) => s.filterAssignee);
  const filterInboxId = useConversationStore((s) => s.filterInboxId);
  const filterLabelId = useConversationStore((s) => s.filterLabelId);
  const openConversation = useConversationStore((s) => s.openConversation);
  const setFilterStatus = useConversationStore((s) => s.setFilterStatus);
  const setFilterAssignee = useConversationStore((s) => s.setFilterAssignee);
  const setFilterInboxId = useConversationStore((s) => s.setFilterInboxId);
  const setFilterLabelId = useConversationStore((s) => s.setFilterLabelId);

  const [search, setSearch] = useState("");
  const [showInboxDropdown, setShowInboxDropdown] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    conversationId: string;
    x: number;
    y: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeInbox = inboxes.find((i) => i.id === filterInboxId);
  const inboxLabels = filterInboxId ? getLabelsForInbox(filterInboxId) : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowInboxDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const inboxFiltered = useMemo(() => {
    if (!filterInboxId) return conversations;
    return conversations.filter((c) => c.inboxId === filterInboxId);
  }, [conversations, filterInboxId]);

  const statusCounts = useMemo(() => {
    const base = inboxFiltered.filter((c) => matchesAssignee(c, filterAssignee, currentAgent?.id));
    return {
      open: base.filter((c) => c.status === "open").length,
      resolved: base.filter((c) => c.status === "resolved").length,
      all: base.length,
    };
  }, [inboxFiltered, filterAssignee, currentAgent?.id]);

  const assigneeCounts = useMemo(() => {
    const base = inboxFiltered.filter((c) => matchesStatus(c, filterStatus));
    return {
      mine: base.filter((c) => currentAgent?.id && c.assignee?.id === currentAgent.id).length,
      unassigned: base.filter((c) => !c.assignee).length,
      all: base.length,
    };
  }, [inboxFiltered, filterStatus, currentAgent?.id]);

  const labelBase = useMemo(() => {
    return inboxFiltered.filter(
      (c) =>
        matchesAssignee(c, filterAssignee, currentAgent?.id) &&
        matchesStatus(c, filterStatus)
    );
  }, [inboxFiltered, filterAssignee, filterStatus, currentAgent?.id]);

  const labelCounts = useMemo(() => {
    return inboxLabels.map((label) => ({
      ...label,
      count: labelBase.filter((c) => c.labels.some((l) => l.id === label.id)).length,
    }));
  }, [inboxLabels, labelBase]);

  const filtered = useMemo(() => {
    let result = conversations;
    if (filterStatus !== "all") result = result.filter((c) => c.status === filterStatus);
    if (filterAssignee === "mine" && currentAgent?.id) {
      result = result.filter((c) => c.assignee?.id === currentAgent.id);
    } else if (filterAssignee === "unassigned") {
      result = result.filter((c) => !c.assignee);
    }
    if (filterInboxId) result = result.filter((c) => c.inboxId === filterInboxId);
    if (filterLabelId) {
      result = result.filter((c) => c.labels.some((label) => label.id === filterLabelId));
    }
    return result;
  }, [conversations, filterStatus, filterAssignee, filterInboxId, filterLabelId, currentAgent?.id]);

  const displayed = search
    ? filtered.filter(
        (c) =>
          c.contact.name.toLowerCase().includes(search.toLowerCase()) ||
          c.lastMessage?.content.toLowerCase().includes(search.toLowerCase())
      )
    : filtered;

  const contextConversation = contextMenu
    ? conversations.find((c) => c.id === contextMenu.conversationId)
    : null;

  return (
    <div className="w-[320px] bg-[var(--color-bg-secondary)] border-r border-[var(--color-border-primary)] flex flex-col shrink-0 h-screen">
      <div className="p-4 pb-2">
        <div className="mb-3">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowInboxDropdown(!showInboxDropdown)}
              className="flex items-center gap-2 text-[var(--color-text-primary)] font-semibold text-[15px] hover:opacity-80 transition-opacity"
            >
              {activeInbox ? activeInbox.name : "Todas las bandejas"}
              <svg className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {showInboxDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg shadow-xl z-50 py-1 animate-fade-in">
                <button
                  onClick={() => { setFilterInboxId(null); setShowInboxDropdown(false); }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-hover)] transition-colors",
                    !filterInboxId ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"
                  )}
                >
                  Todas las bandejas
                </button>
                <div className="h-px bg-[var(--color-border-primary)] my-1" />
                {inboxes.map((inbox) => (
                  <button
                    key={inbox.id}
                    onClick={() => { setFilterInboxId(inbox.id); setShowInboxDropdown(false); }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-hover)] transition-colors flex items-center justify-between",
                      filterInboxId === inbox.id ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"
                    )}
                  >
                    <span>{inbox.name}</span>
                    {inbox.unreadCount > 0 && (
                      <span className="bg-[var(--color-brand)] text-white text-[10px] rounded-full w-[18px] h-[18px] flex items-center justify-center font-semibold">
                        {inbox.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar conversaciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm rounded-lg pl-9 pr-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)] transition-colors placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 mb-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors inline-flex items-center gap-1",
                filterStatus === tab.id
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "tabular-nums",
                  filterStatus === tab.id
                    ? "text-white/75"
                    : "text-[var(--color-text-muted)]"
                )}
              >
                {statusCounts[tab.id as keyof typeof statusCounts]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {assigneeTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterAssignee(tab.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors inline-flex items-center gap-1",
                filterAssignee === tab.id
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "tabular-nums",
                  filterAssignee === tab.id
                    ? "text-white/75"
                    : "text-[var(--color-text-muted)]"
                )}
              >
                {assigneeCounts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {filterInboxId ? (
          labelCounts.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--color-border-primary)]">
              <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                <Tag className="w-3 h-3 text-[var(--color-text-muted)]" />
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  Etiquetas
                </span>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setFilterLabelId(null)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors",
                    !filterLabelId
                      ? "bg-[var(--color-brand)] text-white"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  Todas
                </button>
                {labelCounts.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() =>
                      setFilterLabelId(filterLabelId === label.id ? null : label.id)
                    }
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors inline-flex items-center gap-1.5",
                      filterLabelId === label.id
                        ? "bg-[var(--color-brand)] text-white"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    <LabelColorDot
                      color={label.color}
                      className={cn(
                        "w-1.5 h-1.5",
                        filterLabelId === label.id && "ring-1 ring-white/80"
                      )}
                    />
                    {label.name}
                    <span
                      className={cn(
                        "tabular-nums",
                        filterLabelId === label.id
                          ? "text-white/75"
                          : "text-[var(--color-text-muted)]"
                      )}
                    >
                      {label.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          <p className="mt-2 pt-2 border-t border-[var(--color-border-primary)] text-[11px] text-[var(--color-text-muted)]">
            Selecciona una bandeja para filtrar por etiqueta
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <MessageCircle className="w-12 h-12 text-[var(--color-text-muted)] mb-3 opacity-40" />
            <p className="text-[var(--color-text-secondary)] text-sm font-medium">Sin conversaciones</p>
            <p className="text-[var(--color-text-muted)] text-xs mt-1">
              No hay conversaciones en esta vista
            </p>
          </div>
        ) : (
          displayed.map((conv) => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              onClick={() => openConversation(conv.id)}
              onContextMenu={(e) =>
                setContextMenu({
                  conversationId: conv.id,
                  x: e.clientX,
                  y: e.clientY,
                })
              }
            />
          ))
        )}
      </div>

      {contextMenu && contextConversation && (
        <ConversationContextMenu
          conversation={contextConversation}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
