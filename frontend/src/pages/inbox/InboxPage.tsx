import { useEffect } from "react";
import { ChatArea } from "@/components/chat/ChatArea";
import { ContactDetails } from "@/components/contact-details/ContactDetails";
import { ConversationList } from "@/components/conversation-list/ConversationList";
import { getCurrentAgentId } from "@/lib/authSession";
import { loadActiveConversation } from "@/lib/activeConversationSession";
import { useConversationStore } from "@/store/conversationStore";

export function InboxPage() {
  useEffect(() => {
    const store = useConversationStore.getState();
    store.setInboxViewActive(true);

    const agentId = getCurrentAgentId();
    if (agentId && !store.activeConversationId) {
      const savedConversationId = loadActiveConversation(agentId);
      if (
        savedConversationId &&
        store.conversations.some((conversation) => conversation.id === savedConversationId)
      ) {
        store.openConversation(savedConversationId);
      }
    }

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const current = useConversationStore.getState();
      if (!current.isInboxViewActive || !current.activeConversationId) return;
      current.acknowledgeConversationRead(current.activeConversationId, "tab-visible");
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      store.setInboxViewActive(false);
    };
  }, []);

  return (
    <div className="flex-1 flex min-w-0 h-screen">
      <ConversationList />
      <div className="flex-1 flex min-w-0 relative">
        <ChatArea />
      </div>
      <ContactDetails />
    </div>
  );
}
