import { useEffect } from "react";
import { ChatArea } from "@/components/chat/ChatArea";
import { ContactDetails } from "@/components/contact-details/ContactDetails";
import { ConversationList } from "@/components/conversation-list/ConversationList";
import { useConversationStore } from "@/store/conversationStore";

export function InboxPage() {
  useEffect(() => {
    const store = useConversationStore.getState();
    store.setInboxViewActive(true);

    return () => {
      store.setInboxViewActive(false);
      store.clearActiveConversationSelection();
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
