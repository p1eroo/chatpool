import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Users,
  BarChart3,
  BookOpen,
  Settings,
  Sun,
  Moon,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Check,
  Inbox,
  UserCog,
  Shield,
  Plug,
  Tag,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { LabelColorDot } from "@/components/settings/LabelColorDot";
import { useInboxLabelAccentMap } from "@/hooks/useInboxLabelAccentMap";
import { ProfileMenuPopover } from "@/components/nav-rail/ProfileMenuPopover";
import { useConversationStore } from "@/store/conversationStore";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useInboxStore } from "@/store/inboxStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { useLabelStore } from "@/store/labelStore";
import { useMiniInboxStore } from "@/store/miniInboxStore";
import { useUIStore } from "@/store/uiStore";
import { filterAccessibleInboxes } from "@/lib/agentInboxAccess";
import {
  getFirstSettingsPath,
  useAgentPermissions,
  useCanAccessSettings,
} from "@/hooks/useAgentPermissions";
import type { AgentPermissions } from "@/types";
import { cn } from "@/lib/utils";

const SETTINGS_ITEMS: Array<{
  to: string;
  label: string;
  icon: typeof Inbox;
  permission: keyof AgentPermissions;
}> = [
  { to: "/settings/inboxes", label: "Bandejas", icon: Inbox, permission: "manageInboxes" },
  { to: "/settings/agents", label: "Agentes", icon: UserCog, permission: "manageAgents" },
  { to: "/settings/roles", label: "Roles", icon: Shield, permission: "manageAgents" },
  {
    to: "/settings/integrations",
    label: "Integraciones",
    icon: Plug,
    permission: "manageIntegrations",
  },
];

export function NavRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [inboxMenuOpen, setInboxMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const profileAnchorRef = useRef<HTMLDivElement>(null);
  const currentAgent = useAuthStore((s) => s.getCurrentAgent());
  const permissions = useAgentPermissions();
  const canAccessSettings = useCanAccessSettings();

  /** true = extendido (con nombres), false = colapsado (solo iconos). */
  const expanded = useUIStore((s) => s.navRailOpen);
  const setNavRailOpen = useUIStore((s) => s.setNavRailOpen);

  const allInboxes = useInboxStore((s) => s.inboxes);
  const inboxSettings = useInboxSettingsStore((s) => s.settings);
  const conversations = useConversationStore((s) => s.conversations);
  const filterInboxId = useConversationStore((s) => s.filterInboxId);
  const conversationsInboxId = useConversationStore((s) => s.conversationsInboxId);
  const filterLabelId = useConversationStore((s) => s.filterLabelId);
  const filterMiniInboxId = useConversationStore((s) => s.filterMiniInboxId);
  const setFilterInboxId = useConversationStore((s) => s.setFilterInboxId);
  const setFilterLabelId = useConversationStore((s) => s.setFilterLabelId);
  const setFilterMiniInboxId = useConversationStore((s) => s.setFilterMiniInboxId);
  const allLabels = useLabelStore((s) => s.labels);

  const inboxes = useMemo(
    () => filterAccessibleInboxes(allInboxes, currentAgent?.id, inboxSettings),
    [allInboxes, currentAgent?.id, inboxSettings]
  );

  const settingsItems = useMemo(
    () => SETTINGS_ITEMS.filter((item) => permissions[item.permission]),
    [permissions]
  );

  /** Etiquetas de la bandeja activa (cambian al cambiar de inbox). */
  const inboxLabels = useMemo(
    () => (filterInboxId ? allLabels.filter((label) => label.inboxId === filterInboxId) : []),
    [filterInboxId, allLabels]
  );

  const labelAccentById = useInboxLabelAccentMap(filterInboxId);

  const labelCounts = useMemo(() => {
    if (!filterInboxId) return [] as Array<{ id: string; count: number }>;
    const inInbox = conversations.filter((c) => c.inboxId === filterInboxId);
    return inboxLabels.map((label) => ({
      id: label.id,
      count: inInbox.filter((c) => c.labels.some((l) => l.id === label.id)).length,
    }));
  }, [conversations, filterInboxId, inboxLabels]);

  /** Bandejitas de la bandeja activa. */
  const allMiniInboxes = useMiniInboxStore((s) => s.miniInboxes);
  const miniInboxes = useMemo(
    () =>
      filterInboxId
        ? allMiniInboxes
            .filter((mini) => mini.inboxId === filterInboxId)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        : [],
    [filterInboxId, allMiniInboxes]
  );

  const miniInboxCounts = useMemo(() => {
    if (!filterInboxId) return [] as Array<{ id: string; count: number }>;
    const inInbox = conversations.filter((c) => c.inboxId === filterInboxId);
    return miniInboxes.map((mini) => ({
      id: mini.id,
      count: inInbox.filter((c) => c.miniInboxId === mini.id).length,
    }));
  }, [conversations, filterInboxId, miniInboxes]);

  /** Badge en vivo: chats con no leídos (no suma de mensajes). */
  const liveUnreadByInboxId = useMemo(() => {
    const map = new Map<string, number>();
    for (const conversation of conversations) {
      if (conversation.unreadCount <= 0) continue;
      map.set(conversation.inboxId, (map.get(conversation.inboxId) ?? 0) + 1);
    }
    return map;
  }, [conversations]);

  const getInboxUnread = (inboxId: string, fallback: number) => {
    // Solo conteo en vivo cuando la lista cargada es de esa bandeja (evita borrar badge al cambiar).
    if (conversationsInboxId === inboxId) {
      return liveUnreadByInboxId.get(inboxId) ?? 0;
    }
    return fallback;
  };

  const activeInbox = inboxes.find((inbox) => inbox.id === filterInboxId);
  const activeUnread = activeInbox
    ? getInboxUnread(activeInbox.id, activeInbox.unreadCount)
    : 0;
  const onSettingsRoute = location.pathname.startsWith("/settings");
  const inboxNavActive =
    location.pathname.startsWith("/inbox") || inboxMenuOpen;
  const settingsNavActive = onSettingsRoute || settingsMenuOpen;

  useEffect(() => {
    if (onSettingsRoute) {
      setSettingsMenuOpen(true);
      setInboxMenuOpen(false);
    }
  }, [onSettingsRoute]);

  const navItems = useMemo(() => {
    const items = [
      { id: "contacts", icon: Users, label: "Contactos", path: "/contacts" },
    ];

    if (permissions.viewReports) {
      items.push({ id: "reports", icon: BarChart3, label: "Reportes", path: "/reports" });
    }

    return items;
  }, [permissions.viewReports]);

  const selectInbox = (inboxId: string) => {
    setFilterInboxId(inboxId);
    setSettingsMenuOpen(false);
    setInboxMenuOpen(true);
    navigate("/inbox");
  };

  const selectLabel = (labelId: string) => {
    setFilterMiniInboxId(null);
    setFilterLabelId(filterLabelId === labelId ? null : labelId);
    setSettingsMenuOpen(false);
    setInboxMenuOpen(true);
    if (!location.pathname.startsWith("/inbox")) {
      navigate("/inbox");
    }
  };

  const selectMiniInbox = (miniInboxId: string) => {
    setFilterLabelId(null);
    setFilterMiniInboxId(filterMiniInboxId === miniInboxId ? null : miniInboxId);
    setSettingsMenuOpen(false);
    setInboxMenuOpen(true);
    if (!location.pathname.startsWith("/inbox")) {
      navigate("/inbox");
    }
  };

  const toggleInboxMenu = () => {
    setProfileOpen(false);
    setSettingsMenuOpen(false);

    if (!expanded) {
      setNavRailOpen(true);
      setInboxMenuOpen(true);
      if (filterInboxId && !location.pathname.startsWith("/inbox")) {
        navigate("/inbox");
      }
      return;
    }

    if (!inboxMenuOpen && filterInboxId && !location.pathname.startsWith("/inbox")) {
      navigate("/inbox");
    }
    setInboxMenuOpen((prev) => !prev);
  };

  const toggleSettingsMenu = () => {
    setProfileOpen(false);
    setInboxMenuOpen(false);

    const firstPath = getFirstSettingsPath(permissions);

    if (!expanded) {
      setNavRailOpen(true);
      setSettingsMenuOpen(true);
      if (firstPath && !onSettingsRoute) {
        navigate(firstPath);
      }
      return;
    }

    if (!settingsMenuOpen) {
      setSettingsMenuOpen(true);
      if (firstPath && !onSettingsRoute) {
        navigate(firstPath);
      }
      return;
    }

    setSettingsMenuOpen(false);
  };

  /** Tamaño fijo en ambos modos para que los iconos no “crezcan” al colapsar. */
  const navIconClass = "size-5 shrink-0";
  const navIconSlotClass = "relative flex size-5 shrink-0 items-center justify-center";

  const itemBase = cn(
    "relative flex h-11 items-center rounded-xl transition-colors duration-150",
    expanded ? "w-full px-2.5 gap-2.5" : "w-11 justify-center"
  );

  const itemActive = "bg-[var(--sidebar-item-active-bg)] text-[var(--sidebar-item-active)]";
  const itemIdle =
    "text-[var(--sidebar-item)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--color-text-primary)]";

  const renderSubmenu = (children: ReactNode) => (
    <div className="ml-2 pl-2 border-l border-[var(--sidebar-separator)] py-1 space-y-0.5 animate-fade-in">
      {children}
    </div>
  );

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 h-screen sticky top-0 border-r bg-[var(--sidebar-bg)] border-[var(--sidebar-separator)] transition-[width] duration-200",
        expanded ? "w-[220px]" : "w-[72px]"
      )}
    >
      <div
        className={cn(
          "pt-3 pb-2 flex flex-col gap-1.5",
          expanded ? "px-2.5 items-stretch" : "px-2 items-center"
        )}
      >
        <button
          type="button"
          onClick={() => {
            setInboxMenuOpen(false);
            setSettingsMenuOpen(false);
            setProfileOpen(false);
            setNavRailOpen(!expanded);
          }}
          className={cn(itemBase, itemIdle)}
          title={expanded ? "Colapsar menú" : "Extender menú"}
          aria-label={expanded ? "Colapsar menú" : "Extender menú"}
        >
          {expanded ? (
            <PanelLeftClose className={navIconClass} />
          ) : (
            <PanelLeft className={navIconClass} />
          )}
          {expanded && (
            <span className="text-[13px] font-medium truncate">Colapsar</span>
          )}
        </button>

        <div className={cn("flex flex-col", expanded ? "gap-0.5" : "items-center")}>
          <button
            type="button"
            onClick={toggleInboxMenu}
            title={activeInbox?.name ?? "Seleccionar bandeja"}
            className={cn(itemBase, inboxNavActive ? itemActive : itemIdle)}
          >
            <span className={navIconSlotClass}>
              <MessageSquare className={navIconClass} />
              {!expanded && (
                <ChevronDown className="size-2.5 absolute -bottom-0.5 -right-0.5 opacity-80" />
              )}
              <Badge
                count={activeUnread}
                className="absolute -top-1.5 -right-1.5"
              />
            </span>
            {expanded && (
              <>
                <span className="text-[13px] font-medium truncate flex-1 text-left">
                  {activeInbox?.name ?? "Bandejas"}
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 shrink-0 opacity-70 transition-transform",
                    inboxMenuOpen && "rotate-180"
                  )}
                />
              </>
            )}
          </button>

          {expanded && inboxMenuOpen &&
            renderSubmenu(
              <>
                <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Bandejas
                </p>
                {inboxes.length === 0 ? (
                  <p className="px-2.5 py-1.5 text-[12px] text-[var(--color-text-secondary)]">
                    Sin bandejas
                  </p>
                ) : (
                  inboxes.map((inbox) => {
                    const active = inbox.id === filterInboxId;
                    const unread = getInboxUnread(inbox.id, inbox.unreadCount);
                    return (
                      <button
                        key={inbox.id}
                        type="button"
                        onClick={() => selectInbox(inbox.id)}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors",
                          active
                            ? "bg-[var(--sidebar-item-active-bg)] text-[var(--sidebar-item-active)]"
                            : "text-[var(--sidebar-item)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--color-text-primary)]"
                        )}
                      >
                        <span className="truncate flex items-center gap-1.5 min-w-0">
                          {active && <Check className="w-3 h-3 shrink-0" />}
                          <span className="truncate">{inbox.name}</span>
                        </span>
                        {unread > 0 && (
                          <span className="bg-[var(--color-brand)] text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-semibold shrink-0">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}

                {filterInboxId && (
                  <>
                    <p className="mt-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] flex items-center gap-1.5">
                      <Tag className="w-3 h-3 shrink-0" />
                      Etiquetas
                    </p>
                    {inboxLabels.length === 0 ? (
                      <p className="px-2.5 py-1.5 text-[12px] text-[var(--color-text-secondary)]">
                        Sin etiquetas en esta bandeja
                      </p>
                    ) : (
                      inboxLabels.map((label) => {
                        const active = filterLabelId === label.id;
                        const count =
                          labelCounts.find((item) => item.id === label.id)?.count ?? 0;
                        return (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => selectLabel(label.id)}
                            title={
                              active
                                ? "Quitar filtro de etiqueta"
                                : `Filtrar por ${label.name}`
                            }
                            className={cn(
                              "w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors",
                              active
                                ? "bg-[var(--sidebar-item-active-bg)] text-[var(--sidebar-item-active)]"
                                : "text-[var(--sidebar-item)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--color-text-primary)]"
                            )}
                          >
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              <LabelColorDot
                                color={
                                  labelAccentById[label.id] ?? label.color
                                }
                                className="w-2 h-2 shrink-0"
                              />
                              <span className="truncate">{label.name}</span>
                            </span>
                            <span
                              className={cn(
                                "tabular-nums text-[10px] shrink-0",
                                active
                                  ? "text-[var(--sidebar-item-active)]/70"
                                  : "text-[var(--color-text-muted)]"
                              )}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })
                    )}

                    <p className="mt-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] flex items-center gap-1.5">
                      <Inbox className="w-3 h-3 shrink-0" />
                      Bandejitas
                    </p>
                    {miniInboxes.length === 0 ? (
                      <p className="px-2.5 py-1.5 text-[12px] text-[var(--color-text-secondary)]">
                        Sin bandejitas en esta bandeja
                      </p>
                    ) : (
                      miniInboxes.map((mini) => {
                        const active = filterMiniInboxId === mini.id;
                        const count =
                          miniInboxCounts.find((item) => item.id === mini.id)?.count ?? 0;
                        return (
                          <button
                            key={mini.id}
                            type="button"
                            onClick={() => selectMiniInbox(mini.id)}
                            title={
                              active
                                ? "Quitar filtro de bandejita"
                                : `Filtrar por ${mini.name}`
                            }
                            className={cn(
                              "w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors",
                              active
                                ? "bg-[var(--sidebar-item-active-bg)] text-[var(--sidebar-item-active)]"
                                : "text-[var(--sidebar-item)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--color-text-primary)]"
                            )}
                          >
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              <LabelColorDot
                                color={mini.color}
                                className="w-2 h-2 shrink-0"
                              />
                              <span className="truncate">{mini.name}</span>
                            </span>
                            <span
                              className={cn(
                                "tabular-nums text-[10px] shrink-0",
                                active
                                  ? "text-[var(--sidebar-item-active)]/70"
                                  : "text-[var(--color-text-muted)]"
                              )}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </>
                )}
              </>
            )}
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col gap-1.5 flex-1 overflow-y-auto",
          expanded ? "px-2.5 items-stretch" : "px-2 items-center"
        )}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end
            title={item.label}
            onClick={() => {
              setInboxMenuOpen(false);
              setSettingsMenuOpen(false);
            }}
            className={({ isActive }) =>
              cn(itemBase, isActive ? itemActive : itemIdle)
            }
          >
            <item.icon className={navIconClass} />
            {expanded && (
              <span className="text-[13px] font-medium truncate">{item.label}</span>
            )}
          </NavLink>
        ))}

        {canAccessSettings && settingsItems.length > 0 && (
          <div className={cn("flex flex-col", expanded ? "gap-0.5" : "items-center")}>
            <button
              type="button"
              onClick={toggleSettingsMenu}
              title="Ajustes"
              className={cn(itemBase, settingsNavActive ? itemActive : itemIdle)}
            >
              <span className={navIconSlotClass}>
                <Settings className={navIconClass} />
                {!expanded && (
                  <ChevronDown className="size-2.5 absolute -bottom-0.5 -right-0.5 opacity-80" />
                )}
              </span>
              {expanded && (
                <>
                  <span className="text-[13px] font-medium truncate flex-1 text-left">
                    Ajustes
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 shrink-0 opacity-70 transition-transform",
                      settingsMenuOpen && "rotate-180"
                    )}
                  />
                </>
              )}
            </button>

            {expanded && settingsMenuOpen &&
              renderSubmenu(
                <>
                  <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    Configuración
                  </p>
                  {settingsItems.map((item) => {
                    const active =
                      location.pathname === item.to ||
                      location.pathname.startsWith(`${item.to}/`);
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to !== "/settings/inboxes"}
                        onClick={() => setInboxMenuOpen(false)}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors",
                          active
                            ? "bg-[var(--sidebar-item-active-bg)] text-[var(--sidebar-item-active)]"
                            : "text-[var(--sidebar-item)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--color-text-primary)]"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </>
              )}
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex flex-col gap-1.5 pb-4 shrink-0",
          expanded ? "px-2.5 items-stretch" : "px-2 items-center"
        )}
      >
        <button
          onClick={toggleTheme}
          className={cn(itemBase, itemIdle)}
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
        >
          {theme === "dark" ? (
            <Sun className={navIconClass} />
          ) : (
            <Moon className={navIconClass} />
          )}
          {expanded && (
            <span className="text-[13px] font-medium truncate">
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </span>
          )}
        </button>

        {canAccessSettings && (
          <NavLink
            to="/documentation"
            end
            title="Documentación"
            onClick={() => {
              setInboxMenuOpen(false);
              setSettingsMenuOpen(false);
            }}
            className={({ isActive }) =>
              cn(itemBase, isActive ? itemActive : itemIdle)
            }
          >
            <BookOpen className={navIconClass} />
            {expanded && (
              <span className="text-[13px] font-medium truncate">Documentación</span>
            )}
          </NavLink>
        )}

        <div
          className="relative mt-1"
          ref={profileAnchorRef}
        >
          <button
            type="button"
            onClick={() => {
              setInboxMenuOpen(false);
              setSettingsMenuOpen(false);
              setProfileOpen((prev) => !prev);
            }}
            className={cn(
              "rounded-xl transition-opacity hover:opacity-90 w-full",
              expanded
                ? "flex h-11 items-center gap-2.5 px-2 hover:bg-[var(--sidebar-hover)]"
                : "flex h-11 w-11 items-center justify-center"
            )}
            title={currentAgent?.name ?? "Perfil"}
          >
            <span className="relative shrink-0">
              <Avatar name={currentAgent?.name ?? "?"} size="md" />
              <StatusDot
                status="online"
                className="absolute -bottom-0.5 -right-0.5 !border-[var(--sidebar-bg)]"
              />
            </span>
            {expanded && (
              <span className="min-w-0 text-left">
                <span className="block text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                  {currentAgent?.name ?? "Perfil"}
                </span>
                {currentAgent?.username && (
                  <span className="block text-[11px] text-[var(--color-text-muted)] truncate">
                    @{currentAgent.username}
                  </span>
                )}
              </span>
            )}
          </button>
          <ProfileMenuPopover
            open={profileOpen}
            anchorRef={profileAnchorRef}
            onClose={() => setProfileOpen(false)}
          />
        </div>
      </div>
    </aside>
  );
}
