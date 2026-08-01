import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { LogOut, UserRoundCog } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useAnchoredFixedPosition } from "@/hooks/useAnchoredFixedPosition";
import { useAuthStore } from "@/store/authStore";
import { getAgentDisplayPhone } from "@/store/agentStore";
import { cn } from "@/lib/utils";

interface ProfileMenuPopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function ProfileMenuPopover({
  open,
  anchorRef,
  onClose,
}: ProfileMenuPopoverProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const currentAgent = useAuthStore((s) => s.getCurrentAgent());
  const panelRef = useRef<HTMLDivElement>(null);

  const position = useAnchoredFixedPosition(open, anchorRef, {
    placement: "center-right",
    offsetX: 12,
  });

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !currentAgent || !position) return null;

  const handleProfileSettings = () => {
    navigate("/profile");
    onClose();
  };

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate("/login", { replace: true });
  };

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[120] w-[260px] bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-2xl overflow-hidden animate-fade-in"
      style={{
        left: position.left,
        bottom: position.bottom,
      }}
    >
      <div className="px-4 py-3 border-b border-[var(--color-border-primary)]">
        <div className="flex items-center gap-3">
          <Avatar name={currentAgent.name} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {currentAgent.name}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">
              @{currentAgent.username}
              {currentAgent.phone ? ` · ${getAgentDisplayPhone(currentAgent)}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="py-1">
        <MenuItem icon={UserRoundCog} label="Ajustes del perfil" onClick={handleProfileSettings} />
        <div className="my-1 h-px bg-[var(--color-border-primary)]" />
        <MenuItem icon={LogOut} label="Cerrar sesión" onClick={handleLogout} destructive />
      </div>
    </div>,
    document.body
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors",
        destructive
          ? "text-red-400 hover:bg-red-500/10"
          : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
      )}
    >
      <Icon className="w-4 h-4 shrink-0 text-[var(--color-text-secondary)]" />
      <span>{label}</span>
    </button>
  );
}
