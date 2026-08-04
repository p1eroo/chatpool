import { useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  MessageSquare,
  Users,
  BarChart3,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProfileMenuPopover } from "@/components/nav-rail/ProfileMenuPopover";
import { useConversationStore } from "@/store/conversationStore";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import {
  useAgentPermissions,
  useCanAccessSettings,
} from "@/hooks/useAgentPermissions";

const sItem = "var(--sidebar-item)";
const sHover = "var(--sidebar-hover)";

export function NavRail() {
  const conversations = useConversationStore((s) => s.conversations);
  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );
  const { theme, toggleTheme } = useThemeStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileAnchorRef = useRef<HTMLDivElement>(null);
  const currentAgent = useAuthStore((s) => s.getCurrentAgent());
  const permissions = useAgentPermissions();
  const canAccessSettings = useCanAccessSettings();

  const navItems = useMemo(() => {
    const items = [
      { id: "inbox", icon: MessageSquare, label: "Bandeja", path: "/inbox" },
      { id: "contacts", icon: Users, label: "Contactos", path: "/contacts" },
    ];

    if (permissions.viewReports) {
      items.push({ id: "reports", icon: BarChart3, label: "Reportes", path: "/reports" });
    }

    if (canAccessSettings) {
      items.push({ id: "settings", icon: Settings, label: "Ajustes", path: "/settings" });
    }

    return items;
  }, [permissions.viewReports, canAccessSettings]);

  return (
    <aside
      className="w-[72px] flex flex-col items-center shrink-0 h-screen sticky top-0 border-r"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--sidebar-separator)",
      }}
    >
      <div className="pt-4 pb-2 flex flex-col items-center gap-1">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-brand)] flex items-center justify-center mb-2">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end
            className="relative w-11 h-11 flex items-center justify-center rounded-xl transition-colors duration-150 group"
            style={({ isActive }) => ({
              color: isActive ? "white" : sItem,
              backgroundColor: isActive ? "var(--color-brand)" : "transparent",
            })}
            onMouseEnter={(e) => {
              if (e.currentTarget.style.backgroundColor !== "var(--color-brand)") {
                e.currentTarget.style.backgroundColor = sHover;
                e.currentTarget.style.color = "white";
              }
            }}
            onMouseLeave={(e) => {
              if (e.currentTarget.style.backgroundColor !== "var(--color-brand)") {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = sItem;
              }
            }}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
            {item.id === "inbox" && (
              <Badge count={totalUnread} className="absolute -top-0.5 -right-0.5" />
            )}
          </NavLink>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 pb-4">
        <button
          onClick={toggleTheme}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
          style={{ color: sItem }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = sHover;
            e.currentTarget.style.color = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = sItem;
          }}
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <div className="relative mt-1" ref={profileAnchorRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="relative rounded-full transition-opacity hover:opacity-90"
            title={currentAgent?.name ?? "Perfil"}
          >
            <Avatar name={currentAgent?.name ?? "?"} size="md" />
            <StatusDot
              status="online"
              className="absolute -bottom-0.5 -right-0.5 !border-[var(--sidebar-bg)]"
            />
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
