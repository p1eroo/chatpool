import { AppLoadingState } from "@/components/ui/AppLoadingState";

export function ChatMessagesLoading() {
  return (
    <div className="flex flex-1 min-h-0 flex-col chat-wallpaper">
      <AppLoadingState message="Cargando mensajes…" />
    </div>
  );
}
