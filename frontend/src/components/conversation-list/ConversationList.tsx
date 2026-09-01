import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { ConversationCard } from "./ConversationCard";
import { ConversationContextMenu } from "./ConversationContextMenu";
import { ConversationSelectionBar } from "./ConversationSelectionBar";
import { useCurrentAgent } from "@/hooks/useCurrentAgent";
import { useAgentPermissions } from "@/hooks/useAgentPermissions";
import { useInboxStore } from "@/store/inboxStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { useMiniInboxStore } from "@/store/miniInboxStore";
import { filterAccessibleInboxes } from "@/lib/agentInboxAccess";
import {
  Check,
  Loader2,
  MessageCircle,
  Filter,
  Search,
} from "lucide-react";
import type { AssigneeFilter, ReadFilter } from "@/store/conversationStore";
import type { Conversation } from "@/types";
import { cn } from "@/lib/utils";
import { env } from "@/config/env";
import { conversationApiService } from "@/services/conversationApiService";
import { sortConversations } from "@/lib/conversationSort";
import { useUIStore } from "@/store/uiStore";
import {
  INBOX_SEARCH_MIN_QUERY,
  findMatchingMessageId,
  matchesConversationSearch,
  type ConversationSearchHit,
} from "@/lib/conversationSearch";

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

const readFilterOptions: Array<{ id: ReadFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "unread", label: "No leídos" },
  { id: "read", label: "Leídos" },
];

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

function matchesRead(conversation: Conversation, read: ReadFilter) {
  if (read === "unread") return conversation.unreadCount > 0;
  if (read === "read") return conversation.unreadCount <= 0;
  return true;
}

function ensureConversationInStore(conversation: Conversation) {
  const store = useConversationStore.getState();
  if (store.conversations.some((item) => item.id === conversation.id)) return;
  useConversationStore.setState({
    conversations: sortConversations([...store.conversations, conversation]),
  });
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
  const filterMiniInboxId = useConversationStore((s) => s.filterMiniInboxId);
  const filterRead = useConversationStore((s) => s.filterRead);
  const filterStatusRaw = useConversationStore((s) => s.filterStatus);
  const filterStatus: StatusFilter =
    filterStatusRaw === "resolved" ? "resolved" : "open";
  const openConversation = useConversationStore((s) => s.openConversation);
  const setFilterAssignee = useConversationStore((s) => s.setFilterAssignee);
  const setFilterInboxId = useConversationStore((s) => s.setFilterInboxId);
  const setFilterRead = useConversationStore((s) => s.setFilterRead);
  const setFilterStatus = useConversationStore((s) => s.setFilterStatus);
  const messagesByConversation = useConversationStore((s) => s.messages);

  const locateMessageInConversation = useUIStore((s) => s.locateMessageInConversation);
  const clearMessageLocate = useUIStore((s) => s.clearMessageLocate);
  const [search, setSearch] = useState("");
  const [remoteResults, setRemoteResults] = useState<ConversationSearchHit[] | null>(null);
  const [searchingRemote, setSearchingRemote] = useState(false);
  const searchRequestId = useRef(0);
  const lastAutoLocateKey = useRef<string | null>(null);
  const [readFilterOpen, setReadFilterOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    conversationId: string;
    x: number;
    y: number;
  } | null>(null);
  const headerRowRef = useRef<HTMLDivElement>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const permissions = useAgentPermissions();
  const resolveConversations = useConversationStore((s) => s.resolveConversations);

  const activeInbox = inboxes.find((i) => i.id === filterInboxId);
  const allMiniInboxes = useMiniInboxStore((s) => s.miniInboxes);
  const activeMiniInbox = filterMiniInboxId
    ? allMiniInboxes.find((m) => m.id === filterMiniInboxId)
    : undefined;

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
    searchRequestId.current += 1;
    lastAutoLocateKey.current = null;
    setSearch("");
    setRemoteResults(null);
    setSearchingRemote(false);
  }, [filterInboxId, filterMiniInboxId]);

  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInboxId, filterMiniInboxId, filterStatus, filterAssignee, filterRead, filterLabelId, search]);

  useEffect(() => {
    if (env.useMock) {
      setRemoteResults(null);
      setSearchingRemote(false);
      return;
    }

    const query = search.trim();
    if (query.length < INBOX_SEARCH_MIN_QUERY) {
      setRemoteResults(null);
      setSearchingRemote(false);
      return;
    }

    const requestId = ++searchRequestId.current;
    setRemoteResults(null);
    setSearchingRemote(true);

    const timer = window.setTimeout(() => {
      void conversationApiService
        .search({
          q: query,
          inboxId: filterInboxId,
          miniInboxId: filterMiniInboxId,
        })
        .then((rows) => {
          if (searchRequestId.current !== requestId) return;
          setRemoteResults(rows);
        })
        .catch(() => {
          if (searchRequestId.current !== requestId) return;
          setRemoteResults([]);
        })
        .finally(() => {
          if (searchRequestId.current !== requestId) return;
          setSearchingRemote(false);
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search, filterInboxId, filterMiniInboxId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (headerRowRef.current && !headerRowRef.current.contains(e.target as Node)) {
        setReadFilterOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setReadFilterOpen(false);
        if (selectionMode) {
          clearSelection();
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [selectionMode]);

  const inboxFiltered = useMemo(() => {
    if (!filterInboxId) return conversations;
    return conversations.filter((c) => c.inboxId === filterInboxId);
  }, [conversations, filterInboxId]);

  // Búsqueda: scope = bandeja + bandejita (ignora estado/asignación/etiqueta).
  const miniFiltered = useMemo(() => {
    if (filterMiniInboxId === null) return inboxFiltered.filter((c) => !c.miniInboxId);
    if (filterMiniInboxId) return inboxFiltered.filter((c) => c.miniInboxId === filterMiniInboxId);
    return inboxFiltered;
  }, [inboxFiltered, filterMiniInboxId]);

  // Alcance de la lista: bandeja + estado + etiqueta + bandejita (sin asignación).
  const scoped = useMemo(() => {
    let result = inboxFiltered.filter((c) => matchesStatus(c, filterStatus));
    if (filterLabelId) {
      result = result.filter((c) => c.labels.some((label) => label.id === filterLabelId));
    }
    if (filterMiniInboxId === null) {
      result = result.filter((c) => !c.miniInboxId);
    } else if (filterMiniInboxId) {
      result = result.filter((c) => c.miniInboxId === filterMiniInboxId);
    }
    return result;
  }, [inboxFiltered, filterStatus, filterLabelId, filterMiniInboxId]);

  const assigneeCounts = useMemo(() => {
    const forCounts = scoped.filter((c) => matchesRead(c, filterRead));
    return {
      mine: forCounts.filter((c) =>
        matchesAssignee(c, "mine", currentAgent?.id)
      ).length,
      unassigned: forCounts.filter((c) =>
        matchesAssignee(c, "unassigned", currentAgent?.id)
      ).length,
      all: forCounts.length,
    };
  }, [scoped, filterRead, currentAgent?.id]);

  const filtered = useMemo(
    () =>
      scoped
        .filter((c) => matchesAssignee(c, filterAssignee, currentAgent?.id))
        .filter((c) => matchesRead(c, filterRead)),
    [scoped, filterAssignee, filterRead, currentAgent?.id]
  );

  const activeReadFilterLabel =
    readFilterOptions.find((option) => option.id === filterRead)?.label ?? "Todos";

  const searchQuery = search.trim();
  const isSearching = searchQuery.length > 0;

  useEffect(() => {
    if (isSearching) return;
    lastAutoLocateKey.current = null;
    clearMessageLocate();
  }, [isSearching, clearMessageLocate]);

  const localMatches = useMemo(() => {
    if (!isSearching) return [];
    return miniFiltered.filter((conversation) =>
      matchesConversationSearch(
        conversation,
        searchQuery,
        messagesByConversation[conversation.id]
      )
    );
  }, [isSearching, miniFiltered, searchQuery, messagesByConversation]);

  // Con texto: busca en la bandeja (abiertas/cerradas, mías/sin asignar/todas),
  // incluyendo el historial de mensajes vía API.
  const displayed = useMemo(() => {
    if (!isSearching) return filtered;
    if (env.useMock || !remoteResults) return localMatches;

    const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]));
    const fromRemote = remoteResults
      .map((hit) => byId.get(hit.conversation.id) ?? hit.conversation)
      .filter((conversation) =>
        filterMiniInboxId === null
          ? !conversation.miniInboxId
          : conversation.miniInboxId === filterMiniInboxId
      );
    const remoteIds = new Set(fromRemote.map((conversation) => conversation.id));
    const extraLocal = localMatches.filter((conversation) => !remoteIds.has(conversation.id));
    return [...fromRemote, ...extraLocal];
  }, [isSearching, filtered, localMatches, remoteResults, conversations, filterMiniInboxId]);

  const matchedMessageByConversation = useMemo(() => {
    const map = new Map<string, string>();
    for (const hit of remoteResults ?? []) {
      if (hit.matchedMessageId) map.set(hit.conversation.id, hit.matchedMessageId);
    }
    if (!searchQuery) return map;
    for (const conversation of displayed) {
      if (map.has(conversation.id)) continue;
      const localId = findMatchingMessageId(
        messagesByConversation[conversation.id],
        searchQuery
      );
      if (localId) map.set(conversation.id, localId);
    }
    return map;
  }, [remoteResults, displayed, messagesByConversation, searchQuery]);

  useEffect(() => {
    if (!isSearching || searchingRemote) return;
    if (searchQuery.length < INBOX_SEARCH_MIN_QUERY) return;
    if (!activeConversationId) return;

    const remoteId =
      remoteResults?.find((hit) => hit.conversation.id === activeConversationId)
        ?.matchedMessageId ?? null;
    const messageId =
      remoteId ||
      findMatchingMessageId(messagesByConversation[activeConversationId], searchQuery);
    if (!messageId) return;

    const key = `${searchQuery}:${activeConversationId}:${messageId}`;
    if (lastAutoLocateKey.current === key) return;
    lastAutoLocateKey.current = key;

    locateMessageInConversation({
      conversationId: activeConversationId,
      query: searchQuery,
      messageId,
    });
  }, [
    isSearching,
    searchingRemote,
    searchQuery,
    activeConversationId,
    remoteResults,
    messagesByConversation,
    locateMessageInConversation,
  ]);

  function locateInConversation(conversation: Conversation) {
    const messageId = matchedMessageByConversation.get(conversation.id) ?? null;
    if (!messageId && !searchQuery) return;
    locateMessageInConversation({
      conversationId: conversation.id,
      query: searchQuery,
      messageId,
    });
  }

  function openSearchResult(conversation: Conversation) {
    ensureConversationInStore(conversation);
    locateInConversation(conversation);
    openConversation(conversation.id);
  }

  function enterSelectionMode(conversationId: string) {
    setSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(conversationId);
      return next;
    });
  }

  function toggleSelect(conversationId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(displayed.map((conversation) => conversation.id)));
  }

  function deselectAllVisible() {
    setSelectedIds(new Set());
  }

  function clearSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkResolve() {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    await resolveConversations(ids);
    clearSelection();
  }

  const allVisibleSelected =
    displayed.length > 0 && displayed.every((conversation) => selectedIds.has(conversation.id));

  const contextConversation = contextMenu
    ? conversations.find((c) => c.id === contextMenu.conversationId) ??
      displayed.find((c) => c.id === contextMenu.conversationId) ??
      null
    : null;

  return (
    <div className="relative z-20 flex w-[320px] shrink-0 flex-col h-screen overflow-visible bg-[var(--color-bg-secondary)] border-r border-[var(--color-border-primary)]">
      <div className="px-4 pt-4 pb-0">
        <div className="mb-3 flex items-center justify-between gap-2" ref={headerRowRef}>
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="min-w-0 truncate text-[var(--color-text-primary)] font-semibold text-[15px]">
                {activeInbox?.name ?? (inboxes.length === 0 ? "Sin bandejas" : "Bandeja")}
              </h2>
              {activeMiniInbox && (
                <p className="truncate text-[11px] text-[var(--color-text-muted)] leading-tight">
                  {activeMiniInbox.name}
                </p>
              )}
            </div>

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
              onClick={() => setReadFilterOpen((prev) => !prev)}
              disabled={isSearching}
              className={cn(
                "flex items-center gap-1 shrink-0 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
                isSearching && "opacity-50",
                readFilterOpen || filterRead !== "all"
                  ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
              title="Filtrar por lectura"
              aria-label="Filtrar por lectura"
              aria-expanded={readFilterOpen}
              aria-haspopup="menu"
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="max-w-[4.5rem] truncate">{activeReadFilterLabel}</span>
            </button>
            {readFilterOpen ? (
              <div
                className="absolute top-full right-0 mt-1 w-[160px] bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-xl shadow-xl z-50 p-1 animate-fade-in"
                role="menu"
                aria-label="Filtro de lectura"
              >
                {readFilterOptions.map((option) => {
                  const active = filterRead === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        setFilterRead(option.id);
                        setReadFilterOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      {option.label}
                      {active ? <Check className="w-3.5 h-3.5 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder={
              activeMiniInbox
                ? `Buscar en ${activeMiniInbox.name}...`
                : "Buscar en toda la bandeja..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm rounded-lg pl-9 pr-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)] transition-colors placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        {isSearching ? (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            {searchingRemote ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
            ) : null}
            Buscando en {activeMiniInbox ? activeMiniInbox.name : "toda la bandeja"} (
            {displayed.length})
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

      <div className="relative flex-1 min-h-0 overflow-visible">
        <div className="h-full overflow-y-auto">
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
                  {searchingRemote
                    ? "Buscando en contactos y mensajes..."
                    : "No hay conversaciones que coincidan en contactos o mensajes"}
                </p>
              </>
            ) : (
              <>
                <p className="text-[var(--color-text-secondary)] text-sm font-medium">
                  Sin conversaciones
                </p>
                <p className="text-[var(--color-text-muted)] text-xs mt-1">
                  {filterRead === "unread"
                    ? "No hay conversaciones no leídas en esta vista"
                    : filterRead === "read"
                      ? "No hay conversaciones leídas en esta vista"
                      : "No hay conversaciones en esta vista"}
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
              isSelectMode={selectionMode}
              isSelected={selectedIds.has(conv.id)}
              onToggleSelect={() => toggleSelect(conv.id)}
              onClick={() => {
                if (isSearching) {
                  openSearchResult(conv);
                  return;
                }
                if (selectionMode) {
                  toggleSelect(conv.id);
                  return;
                }
                ensureConversationInStore(conv);
                openConversation(conv.id);
              }}
              onContextMenu={(e) => {
                ensureConversationInStore(conv);
                setContextMenu({
                  conversationId: conv.id,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
            />
          ))
        )}
        </div>

        {selectionMode ? (
          <div className="pointer-events-none absolute right-0 top-3 z-30 w-max translate-x-full pl-3">
            <ConversationSelectionBar
              className="pointer-events-auto"
              selectedCount={selectedIds.size}
              allVisibleSelected={allVisibleSelected}
              canResolve={permissions.resolveConversations}
              onClear={clearSelection}
              onSelectAll={selectAllVisible}
              onDeselectAll={deselectAllVisible}
              onResolve={() => void handleBulkResolve()}
            />
          </div>
        ) : null}
      </div>

      {contextMenu && contextConversation && (
        <ConversationContextMenu
          conversation={contextConversation}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSelectConversation={enterSelectionMode}
        />
      )}
    </div>
  );
}
