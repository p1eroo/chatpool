import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 96;

export function isChatScrollNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
}

function scrollContainerToBottom(el: HTMLElement) {
  el.scrollTop = el.scrollHeight;
}

function scrollContainerToBottomAfterLayout(el: HTMLElement) {
  requestAnimationFrame(() => {
    scrollContainerToBottom(el);
    requestAnimationFrame(() => scrollContainerToBottom(el));
  });
}

interface UseChatScrollAnchorOptions {
  conversationId: string | null;
  messageCount: number;
  isLoadingMessages: boolean;
  isTyping?: boolean;
}

export function useChatScrollAnchor({
  conversationId,
  messageCount,
  isLoadingMessages,
  isTyping = false,
}: UseChatScrollAnchorOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldStickRef = useRef(true);
  const prevMessageMetaRef = useRef<{ conversationId: string | null; length: number }>({
    conversationId: null,
    length: 0,
  });

  const [isNearBottom, setIsNearBottom] = useState(true);

  const syncStickFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return false;

    const near = isChatScrollNearBottom(el);
    shouldStickRef.current = near;
    setIsNearBottom(near);
    return near;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;

    shouldStickRef.current = true;
    setIsNearBottom(true);

    if (behavior === "auto") {
      scrollContainerToBottomAfterLayout(el);
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const stickToBottomIfNeeded = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !shouldStickRef.current) return;
    scrollContainerToBottom(el);
  }, []);

  const releaseStick = useCallback(() => {
    shouldStickRef.current = false;
    setIsNearBottom(false);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      syncStickFromScroll();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [conversationId, syncStickFromScroll]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      stickToBottomIfNeeded();
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [conversationId, stickToBottomIfNeeded]);

  useEffect(() => {
    shouldStickRef.current = true;
    setIsNearBottom(true);
    prevMessageMetaRef.current = { conversationId, length: messageCount };
    scrollToBottom("auto");
  }, [conversationId, scrollToBottom]);

  useEffect(() => {
    const prev = prevMessageMetaRef.current;

    if (prev.conversationId !== conversationId) {
      prevMessageMetaRef.current = { conversationId, length: messageCount };
      return;
    }

    if (messageCount > prev.length) {
      if (prev.length === 0) {
        scrollToBottom("auto");
      } else if (shouldStickRef.current) {
        scrollToBottom("smooth");
      }
    }

    prevMessageMetaRef.current = { conversationId, length: messageCount };
  }, [conversationId, messageCount, scrollToBottom]);

  useEffect(() => {
    if (!isLoadingMessages && messageCount > 0) {
      scrollToBottom("auto");
    }
  }, [isLoadingMessages, messageCount, scrollToBottom]);

  useEffect(() => {
    if (isTyping && shouldStickRef.current) {
      stickToBottomIfNeeded();
    }
  }, [isTyping, stickToBottomIfNeeded]);

  return {
    scrollRef,
    contentRef,
    bottomRef,
    isNearBottom,
    shouldStickRef,
    scrollToBottom,
    releaseStick,
  };
}
