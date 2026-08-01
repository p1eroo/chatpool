import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, MoreVertical, PauseCircle, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnchoredFixedPosition } from "@/hooks/useAnchoredFixedPosition";
import { useUIStore } from "@/store/uiStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";

interface InboxRowMenuProps {
  inboxId: string;
  status: "active" | "pending" | "disabled";
}

export function InboxRowMenu({ inboxId, status }: InboxRowMenuProps) {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const updateStatus = useInboxSettingsStore((s) => s.updateStatus);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const position = useAnchoredFixedPosition(open, anchorRef, {
    placement: "below-right",
    offsetY: 4,
  });

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
        title="Opciones de bandeja"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[120] w-52 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg shadow-xl py-1 animate-fade-in"
            style={{
              top: position.top,
              right: position.right,
            }}
          >
            <button
              type="button"
              onClick={() => {
                close();
                navigate(`/settings/inboxes/${inboxId}`);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <Settings2 className="w-4 h-4 shrink-0" />
              Configurar bandeja
            </button>
            <Link
              to={`/settings/inboxes/${inboxId}?section=integration`}
              onClick={close}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              Ver integración
            </Link>
            <div className="h-px bg-[var(--color-border-primary)] my-1" />
            <button
              type="button"
              onClick={() => {
                updateStatus(inboxId, status === "disabled" ? "active" : "disabled");
                showToast(status === "disabled" ? "Bandeja activada" : "Bandeja desactivada");
                close();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <PauseCircle className="w-4 h-4 shrink-0" />
              {status === "disabled" ? "Activar bandeja" : "Desactivar bandeja"}
            </button>
            <button
              type="button"
              onClick={() => {
                showToast("Eliminar bandeja estará disponible con la API");
                close();
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors",
                "text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
              )}
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              Eliminar bandeja
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
