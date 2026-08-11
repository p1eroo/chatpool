import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { ConversationCard } from "./ConversationCard";
import { ConversationContextMenu } from "./ConversationContextMenu";
import { useCurrentAgent } from "@/hooks/useCurrentAgent";
import { useInboxStore } from "@/store/inboxStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { filterAccessibleInboxes } from "@/lib/agentInboxAccess";
import {
  Search,
  MessageCircle,
  Settings,
} from "lucide-react";
import { InboxNotificationSettingsPopover } from "./InboxNotificationSettingsPopover";
import type { AssigneeFilter } from "@/store/conversationStore";
import type { Conversation } from "@/types";
import { cn } from "@/lib/utils";
import { formatLocalWhatsAppPhoneDisplay } from "@/lib/whatsappPhone";

const statusTabs = [
  { id: "open", label: "Abierto" },
  { id: "resolved", label: "Cerrado" },
] as const;

type StatusFilter = (typeof statusTabs)[number]["id"];

const assigneeTabs = [
  { id: "mine", label: "Mías" },
  { id: "unassigned", label: "Sin asignar" },
  { id: "all", label: "Todas" },
] as const;

function matchesAssignee(
  conversation: Conversation,
  assignee: AssigneeFilter,
  currentAgentId?: string
) {
  if (assignee === "mine") {
    return Boolean(currentAgentId && conversation.assignee?.id === currentAgentId);
  }
  if (assignee === "unassigned") return !conversation.assignee;
  return true;
}

function matchesStatus(conversation: Conversation, status: StatusFilter) {
  return conversation.status === status;
}

/** Búsqueda general por bandeja: ignora tabs de estado/asignación. */
function matchesConversationSearch(conversation: Conversation, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const phone = conversation.contact.phone ?? "";
  const haystack = [
    conversation.contact.name,
    phone,
    formatLocalWhatsAppPhoneDisplay(phone),
    conversation.contact.email,
    conversation.contact.waId,
    conversation.lastMessage?.content,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function ConversationList() {
  const currentAgent = useCurrentAgent();
  const conversations = useConversationStore((s) => s.conversations);
  const allInboxes = useInboxStore((s) => s.inboxes);
  const inboxSettings = useInboxSettingsStore((s) => s.settings);
  const inboxes = useMemo(
    () => filterAccessibleInboxes(allInboxes, currentAgent?.id, inboxSettings),
    [allInboxes, currentAgent?.id, inboxSettings]
  );
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const filterAssignee = useConversationStore((s) => s.filterAssignee);
  const filterInboxId = useConversationStore((s) => s.filterInboxId);
  const filterLabelId = useConversationStore((s) => s.filterLabelId);
  const filterStatusRaw = useConversationStore((s) => s.filterStatus);
  const filterStatus: StatusFilter =
    filterStatusRaw === "resolved" ? "resolved" : "open";
  const openConversation = useConversationStore((s) => s.openConversation);
  const setFilterAssignee = useConversationStore((s) => s.setFilterAssignee);
  const setFilterInboxId = useConversationStore((s) => s.setFilterInboxId);
  const setFilterStatus = useConversationStore((s) => s.setFilterStatus);

  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    conversationId: string;
    x: number;
    y: number;
  } | null>(null);
  const headerRowRef = useRef<HTMLDivElement>(null);

  const activeInbox = inboxes.find((i) => i.id === filterInboxId);

  useEffect(() => {
    if (inboxes.length === 0) {
      if (filterInboxId !== null) setFilterInboxId(null);
      return;
    }
    if (!filterInboxId || !inboxes.some((inbox) => inbox.id === filterInboxId)) {
      setFilterInboxId(inboxes[0].id);
    }
  }, [filterInboxId, inboxes, setFilterInboxId]);

  useEffect(() => {
    setSearch("");
  }, [filterInboxId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (headerRowRef.current && !headerRowRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSettingsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const inboxFiltered = useMemo(() => {
    if (!filterInboxId) return conversations;
    return conversations.filter((c) => c.inboxId === filterInboxId);
  }, [conversations, filterInboxId]);

  const statusFiltered = useMemo(
    () => inboxFiltered.filter((c) => matchesStatus(c, filterStatus)),
    [inboxFiltered, filterStatus]
  );

  const assigneeCounts = useMemo(() => {
    return {
      mine: statusFiltered.filter((c) =>
        matchesAssignee(c, "mine", currentAgent?.id)
      ).length,
      unassigned: statusFiltered.filter((c) =>
        matchesAssignee(c, "unassigned", currentAgent?.id)
      ).length,
      all: statusFiltered.length,
    };
  }, [statusFiltered, currentAgent?.id]);

  const filtered = useMemo(() => {
    let result = conversations;
    result = result.filter((c) => matchesStatus(c, filterStatus));
    result = result.filter((c) =>
      matchesAssignee(c, filterAssignee, currentAgent?.id)
    );
    if (filterInboxId) result = result.filter((c) => c.inboxId === filterInboxId);
    if (filterLabelId) {
      result = result.filter((c) => c.labels.some((label) => label.id === filterLabelId));
    }
    return result;
  }, [
    conversations,
    filterStatus,
    filterAssignee,
    filterInboxId,
    filterLabelId,
    currentAgent?.id,
  ]);

  const searchQuery = search.trim();
  const isSearching = searchQuery.length > 0;

  // Con texto: busca en toda la bandeja (abiertas/cerradas, mías/sin asignar/todas).
  const displayed = useMemo(() => {
    if (!isSearching) return filtered;
    return inboxFiltered.filter((c) => matchesConversationSearch(c, searchQuery));
  }, [isSearching, filtered, inboxFiltered, searchQuery]);

  const contextConversation = contextMenu
    ? conversations.find((c) => c.id === contextMenu.conversationId)
    : null;

  return (
    <div className="w-[320px] bg-[var(--color-bg-secondary)] border-r border-[var(--color-border-primary)] flex flex-col shrink-0 h-screen">
      <div className="px-4 pt-4 pb-0">
        <div className="mb-3 flex items-center justify-between gap-2" ref={headerRowRef}>
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <h2 className="min-w-0 truncate text-[var(--color-text-primary)] font-semibold text-[15px]">
              {activeInbox?.name ?? (inboxes.length === 0 ? "Sin bandejas" : "Bandeja")}
            </h2>

            <div
              className="flex shrink-0 rounded-full bg-[var(--color-bg-tertiary)] p-0.5"
              role="tablist"
              aria-label="Filtro por estado"
            >
              {statusTabs.map((tab) => {
                const active = filterStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={isSearching}
                    onClick={() => setFilterStatus(tab.id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium leading-none transition-colors",
                      isSearching && "opacity-50",
                      active
                        ? "bg-[var(--color-bg-secondary)] text-[var(--control-selected-fg)] shadow-sm"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className={cn(
                "flex items-center shrink-0 transition-opacity hover:opacity-80",
                settingsOpen
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)]"
              )}
              title="Notificaciones"
              aria-label="Configurar notificaciones"
              aria-expanded={settingsOpen}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <InboxNotificationSettingsPopover open={settingsOpen} />
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar en toda la bandeja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm rounded-lg pl-9 pr-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)] transition-colors placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        {isSearching ? (
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
            Buscando en toda la bandeja ({displayed.length})
          </p>
        ) : null}

        <div
          className={cn(
            "grid grid-cols-3 gap-0.5 rounded-lg bg-[var(--color-bg-tertiary)] p-0.5",
            isSearching && "pointer-events-none opacity-50"
          )}
          role="tablist"
          aria-label="Filtro por asignación"
          aria-disabled={isSearching}
        >
          {assigneeTabs.map((tab) => {
            const active = filterAssignee === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={isSearching}
                onClick={() => setFilterAssignee(tab.id)}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center transition-colors",
                  active
                    ? "bg-[var(--color-bg-secondary)] text-[var(--control-selected-fg)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <span className="w-full truncate text-[11px] font-medium leading-tight">
                  {tab.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] tabular-nums leading-none",
                    active
                      ? "text-[var(--control-selected-fg)]/70"
                      : "text-[var(--color-text-muted)]"
                  )}
                >
                  {assigneeCounts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-b border-[var(--color-border-primary)]" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <MessageCircle className="w-12 h-12 text-[var(--color-text-muted)] mb-3 opacity-40" />
            {inboxes.length === 0 ? (
              <>
                <p className="text-[var(--color-text-secondary)] text-sm font-medium">
                  Sin bandejas asignadas
                </p>
                <p className="text-[var(--color-text-muted)] text-xs mt-1">
                  Pide a un administrador que te dé acceso a una bandeja
                </p>
              </>
            ) : isSearching ? (
              <>
                <p className="text-[var(--color-text-secondary)] text-sm font-medium">
                  Sin resultados
                </p>
                <p className="text-[var(--color-text-muted)] text-xs mt-1">
                  No hay conversaciones que coincidan en esta bandeja
                </p>
              </>
            ) : (
              <>
                <p className="text-[var(--color-text-secondary)] text-sm font-medium">
                  Sin conversaciones
                </p>
                <p className="text-[var(--color-text-muted)] text-xs mt-1">
                  No hay conversaciones en esta vista
                </p>
              </>
            )}
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
