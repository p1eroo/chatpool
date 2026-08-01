import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { useUIStore } from "@/store/uiStore";
import { MessageBubble } from "./MessageBubble";
import { MessageContextMenu } from "./MessageContextMenu";
import { formatDate } from "@/lib/utils";
import type { Message } from "@/types";
import { ChatHeader } from "./ChatHeader";

export function MessageList() {
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const allMessages = useConversationStore((s) => s.messages);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );
  const messages = useMemo(
    () => (activeConversationId ? allMessages[activeConversationId] || [] : []),
    [allMessages, activeConversationId]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    messageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const jumpToMessageId = useUIStore((s) => s.jumpToMessageId);
  const clearJumpToMessage = useUIStore((s) => s.clearJumpToMessage);
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeConversation?.id]);

  useEffect(() => {
    if (!jumpToMessageId || !scrollRef.current) return;

    const target = scrollRef.current.querySelector(
      `[data-message-id="${jumpToMessageId}"]`
    );

    clearJumpToMessage();

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
  }, [jumpToMessageId, clearJumpToMessage, showToast, messages]);

  useEffect(() => {
    setContextMenu(null);
  }, [activeConversationId]);

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ChatHeader conversation={activeConversation} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
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
                  key={msg.id}
                  message={msg}
                  isHighlighted={highlightedMessageId === msg.id}
                  attachedToMessage={attachedToMessage}
                  hasAttachedNotesAbove={hasAttachedNotesAbove}
                  isMenuOpen={contextMenu?.messageId === msg.id}
                  isLastInGroup={
                    msg.isPrivate ||
                    i === group.messages.length - 1 ||
                    group.messages[i + 1]?.senderType !== msg.senderType ||
                    group.messages[i + 1]?.isPrivate !== msg.isPrivate ||
                    !!group.messages[i + 1]?.attachedToMessageId
                  }
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
