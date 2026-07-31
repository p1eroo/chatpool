import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";

export function ChatArea() {
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const toast = useUIStore((s) => s.toast);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-primary)] h-screen relative">
      <MessageList />
      {activeConversationId && <ChatComposer />}
      {toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] text-sm text-[var(--color-text-primary)] shadow-xl animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
