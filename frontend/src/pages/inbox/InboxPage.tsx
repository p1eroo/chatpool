import { useEffect, useRef } from "react";
import { ChatArea } from "@/components/chat/ChatArea";
import { ContactDetails } from "@/components/contact-details/ContactDetails";
import { ConversationList } from "@/components/conversation-list/ConversationList";
import { getCurrentAgentId } from "@/lib/authSession";
import {
  clearReloadActiveConversation,
  consumeReloadActiveConversation,
  isPageReloadNavigation,
  saveReloadActiveConversation,
} from "@/lib/activeConversationSession";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";

export function InboxPage() {
  const persistingForReloadRef = useRef(false);

  useEffect(() => {
    const store = useConversationStore.getState();
    store.setInboxViewActive(true);

    const agentId = getCurrentAgentId();
    if (agentId && isPageReloadNavigation()) {
      const savedConversationId = consumeReloadActiveConversation(agentId);
      if (
        savedConversationId &&
        store.conversations.some((conversation) => conversation.id === savedConversationId)
      ) {
        store.openConversation(savedConversationId);
      }
    }

    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;

      const currentAgentId = getCurrentAgentId();
      const { activeConversationId } = useConversationStore.getState();
      if (currentAgentId && activeConversationId) {
        saveReloadActiveConversation(currentAgentId, activeConversationId);
        persistingForReloadRef.current = true;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        store.clearActiveConversationSelection();
        return;
      }

      if (document.visibilityState !== "visible") return;
      const current = useConversationStore.getState();
      if (!current.isInboxViewActive || !current.activeConversationId) return;
      current.acknowledgeConversationRead(current.activeConversationId, "tab-visible");
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      store.setInboxViewActive(false);

      const currentAgentId = getCurrentAgentId();
      if (currentAgentId && !persistingForReloadRef.current) {
        clearReloadActiveConversation(currentAgentId);
      }

      store.clearActiveConversationSelection();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;

      const ui = useUIStore.getState();
      if (ui.lightboxMessageId || ui.forwardModalOpen) return;

      if (ui.forwardSelectionMode) {
        e.preventDefault();
        ui.clearForwardFlow();
        return;
      }

      if (document.querySelector("[data-modal-overlay]")) return;

      const { activeConversationId, selectConversation } = useConversationStore.getState();
      if (!activeConversationId) return;

      e.preventDefault();
      selectConversation(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
