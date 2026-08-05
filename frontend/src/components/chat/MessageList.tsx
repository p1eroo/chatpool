import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Forward, X } from "lucide-react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { useChatScrollAnchor } from "@/hooks/useChatScrollAnchor";
import { MessageBubble } from "./MessageBubble";
import { MessageContextMenu } from "./MessageContextMenu";
import { ChatMessagesLoading } from "./ChatMessagesLoading";
import { formatDate } from "@/lib/utils";
import { sortMessagesChronologically } from "@/lib/messageOrder";
import { isForwardableMessage } from "@/lib/forwardMessages";
import { isLastMessageInSenderGroup } from "@/lib/messageSenderGroup";
import type { Message } from "@/types";
import { ChatHeader } from "./ChatHeader";

export function MessageList() {
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const allMessages = useConversationStore((s) => s.messages);
  const messagesLoading = useConversationStore((s) => s.messagesLoading);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );
  const messages = useMemo(() => {
    const raw = activeConversationId ? allMessages[activeConversationId] || [] : [];
    return sortMessagesChronologically(raw);
  }, [allMessages, activeConversationId]);

  const isLoadingMessages = Boolean(
    activeConversationId && messagesLoading[activeConversationId]
  );

  const {
    scrollRef,
    contentRef,
    bottomRef,
    isNearBottom,
    scrollToBottom,
    releaseStick,
  } = useChatScrollAnchor({
    conversationId: activeConversation?.id ?? null,
    messageCount: messages.length,
    isLoadingMessages,
    isTyping: activeConversation?.isTyping ?? false,
  });

  const prevNewMessageMetaRef = useRef<{ conversationId: string | null; length: number }>({
    conversationId: null,
    length: 0,
  });
  const [newBelowCount, setNewBelowCount] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    messageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const jumpToMessageId = useUIStore((s) => s.jumpToMessageId);
  const clearJumpToMessage = useUIStore((s) => s.clearJumpToMessage);
  const showToast = useUIStore((s) => s.showToast);
  const forwardSelectionMode = useUIStore((s) => s.forwardSelectionMode);
  const forwardSelectedMessageIds = useUIStore((s) => s.forwardSelectedMessageIds);
  const forwardSourceConversationId = useUIStore((s) => s.forwardSourceConversationId);
  const toggleForwardMessageSelection = useUIStore((s) => s.toggleForwardMessageSelection);
  const openForwardModal = useUIStore((s) => s.openForwardModal);
  const clearForwardFlow = useUIStore((s) => s.clearForwardFlow);

  useEffect(() => {
    const conversationId = activeConversation?.id ?? null;
    const prev = prevNewMessageMetaRef.current;
    const length = messages.length;

    if (conversationId !== prev.conversationId) {
      prevNewMessageMetaRef.current = { conversationId, length };
      setNewBelowCount(0);
      return;
    }

    if (length > prev.length && !isNearBottom) {
      const added = messages.slice(prev.length);
      const addedContact = added.filter((message) => message.senderType === "contact").length;
      if (addedContact > 0) {
        setNewBelowCount((count) => count + addedContact);
      }
    }

    if (isNearBottom) {
      setNewBelowCount(0);
    }

    prevNewMessageMetaRef.current = { conversationId, length };
  }, [messages, activeConversation?.id, isNearBottom]);

  useEffect(() => {
    if (!jumpToMessageId || !scrollRef.current) return;

    const target = scrollRef.current.querySelector(
      `[data-message-id="${jumpToMessageId}"]`
    );

    clearJumpToMessage();
    releaseStick();

    if (!target) {
      showToast("No se encontró el mensaje citado en esta conversación");
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(jumpToMessageId);

    const timer = window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === jumpToMessageId ? null : current));
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [jumpToMessageId, clearJumpToMessage, showToast, messages, scrollRef, releaseStick]);

  useEffect(() => {
    setContextMenu(null);
  }, [activeConversationId]);

  useEffect(() => {
    if (
      forwardSourceConversationId &&
      activeConversationId &&
      forwardSourceConversationId !== activeConversationId
    ) {
      clearForwardFlow();
    }
  }, [activeConversationId, forwardSourceConversationId, clearForwardFlow]);

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3 className="text-[var(--color-text-primary)] font-semibold mb-1">
            Chatpool
          </h3>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Selecciona una conversación para empezar
          </p>
        </div>
      </div>
    );
  }

  const messageGroups = messages.reduce<{ date: string; messages: Message[] }[]>((groups, msg) => {
    const dateKey = formatDate(msg.createdAt);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ date: dateKey, messages: [msg] });
    }

    return groups;
  }, []);

  const contextMessage = contextMenu
    ? messages.find((m) => m.id === contextMenu.messageId)
    : null;

  const openMessageMenu = (
    messageId: string,
    anchor: HTMLElement,
    clientPoint?: { x: number; y: number }
  ) => {
    const rect = anchor.getBoundingClientRect();
    setContextMenu({
      messageId,
      x: clientPoint?.x ?? rect.left,
      y: clientPoint?.y ?? rect.bottom + 4,
    });
  };

  const newMessagesLabel =
    newBelowCount === 1 ? "1 mensaje nuevo" : `${newBelowCount} mensajes nuevos`;

  const isForwardSelectionActive =
    forwardSelectionMode &&
    forwardSourceConversationId === activeConversationId;

  const selectedForwardCount = forwardSelectedMessageIds.length;

  const handleScrollToBottom = () => {
    scrollToBottom("smooth");
    setNewBelowCount(0);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ChatHeader conversation={activeConversation} />
      {isLoadingMessages && messages.length === 0 ? (
        <ChatMessagesLoading />
      ) : (
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} className="h-full overflow-y-auto py-3">
          <div ref={contentRef}>
          {messageGroups.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>
              {group.messages.map((msg, i) => {
                const attachedToMessage = msg.attachedToMessageId
                  ? messages.find((m) => m.id === msg.attachedToMessageId)
                  : undefined;
                const hasAttachedNotesAbove = messages.some(
                  (m) => m.attachedToMessageId === msg.id
                );

                return (
                  <MessageBubble
                    key={msg.clientId ?? msg.id}
                    message={msg}
                    contactName={activeConversation.contact.name}
                    isHighlighted={highlightedMessageId === msg.id}
                    attachedToMessage={attachedToMessage}
                    hasAttachedNotesAbove={hasAttachedNotesAbove}
                    isMenuOpen={contextMenu?.messageId === msg.id}
                    isForwardSelectable={isForwardSelectionActive && isForwardableMessage(msg)}
                    isForwardSelected={forwardSelectedMessageIds.includes(msg.id)}
                    onForwardToggle={() => toggleForwardMessageSelection(msg.id)}
                    isLastInGroup={isLastMessageInSenderGroup(msg, group.messages[i + 1])}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openMessageMenu(msg.id, e.currentTarget as HTMLElement, {
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMenuOpen={(e) => {
                      openMessageMenu(msg.id, e.currentTarget);
                    }}
                  />
                );
              })}
            </div>
          ))}
          {activeConversation.isTyping && (
            <div className="px-4 mb-3">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-secondary)] rounded-full animate-bounce-dot" style={{ animationDelay: "0s" }} />
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-secondary)] rounded-full animate-bounce-dot" style={{ animationDelay: "0.15s" }} />
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-secondary)] rounded-full animate-bounce-dot" style={{ animationDelay: "0.3s" }} />
                </span>
                {activeConversation.contact.name} está escribiendo...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
          </div>
        </div>

        {newBelowCount > 0 && !isNearBottom && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/95 px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] shadow-lg backdrop-blur-sm transition-colors hover:bg-[var(--color-bg-tertiary)] animate-fade-in"
          >
            <ChevronDown className="h-3.5 w-3.5 text-[var(--color-brand)]" />
            {newMessagesLabel}
          </button>
        )}
      </div>
      )}

      {isForwardSelectionActive && (
        <div className="shrink-0 flex items-center gap-4 border-t border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] px-4 py-3">
          <button
            type="button"
            onClick={clearForwardFlow}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            aria-label="Cancelar selección"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)]">
            {selectedForwardCount === 0
              ? "Selecciona mensajes"
              : selectedForwardCount === 1
                ? "1 seleccionado"
                : `${selectedForwardCount} seleccionados`}
          </span>
          <button
            type="button"
            onClick={() => {
              if (selectedForwardCount === 0) {
                showToast("Selecciona al menos un mensaje");
                return;
              }
              openForwardModal();
            }}
            disabled={selectedForwardCount === 0}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Reenviar mensajes seleccionados"
          >
            <Forward className="h-5 w-5" />
          </button>
        </div>
      )}

      {contextMenu &&
        activeConversationId &&
        contextMessage &&
        contextMessage.senderType !== "system" && (
          <MessageContextMenu
            message={contextMessage}
            conversationId={activeConversationId}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          />
        )}
    </div>
  );
}
