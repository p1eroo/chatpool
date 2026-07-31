import { ConversationList } from "@/components/conversation-list/ConversationList";
import { ChatArea } from "@/components/chat/ChatArea";
import { ContactDetails } from "@/components/contact-details/ContactDetails";

export function InboxPage() {
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
