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
        store.selectConversation(savedConversationId);
      }
    }

    return () => {
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
