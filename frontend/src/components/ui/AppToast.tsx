import { useUIStore } from "@/store/uiStore";

export function AppToast() {
  const toast = useUIStore((s) => s.toast);
  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] shadow-xl animate-fade-in">
      {toast}
    </div>
  );
}
