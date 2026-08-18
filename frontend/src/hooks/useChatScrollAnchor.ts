import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 96;

export function isChatScrollNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
}

function scrollContainerToBottom(el: HTMLElement) {
  el.scrollTop = el.scrollHeight;
}

function scrollContainerToBottomAfterLayout(
  el: HTMLElement,
  isBlocked?: () => boolean
) {
  requestAnimationFrame(() => {
    if (isBlocked?.()) return;
    scrollContainerToBottom(el);
    requestAnimationFrame(() => {
      if (isBlocked?.()) return;
      scrollContainerToBottom(el);
    });
  });
}

interface UseChatScrollAnchorOptions {
  conversationId: string | null;
  messageCount: number;
  isLoadingMessages: boolean;
  isTyping?: boolean;
  /** Evita bajar al final si hay que ubicar un mensaje (búsqueda / cita). */
  suppressAutoScroll?: boolean;
}

export function useChatScrollAnchor({
  conversationId,
  messageCount,
  isLoadingMessages,
  isTyping = false,
  suppressAutoScroll = false,
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
  const suppressAutoScrollRef = useRef(suppressAutoScroll);
  suppressAutoScrollRef.current = suppressAutoScroll;
  const holdUntilRef = useRef(0);
  const wasLoadingRef = useRef(isLoadingMessages);

  const isAutoScrollBlocked = useCallback(() => {
    return suppressAutoScrollRef.current || Date.now() < holdUntilRef.current;
  }, []);

  const syncStickFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return false;

    const near = isChatScrollNearBottom(el);
    shouldStickRef.current = near;
    setIsNearBottom(near);
    return near;
  }, []);

  const holdAutoScroll = useCallback((ms = 3000) => {
    holdUntilRef.current = Date.now() + ms;
    shouldStickRef.current = false;
    setIsNearBottom(false);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (isAutoScrollBlocked()) return;
    const el = scrollRef.current;
    if (!el) return;

    shouldStickRef.current = true;
    setIsNearBottom(true);

    if (behavior === "auto") {
      scrollContainerToBottomAfterLayout(el, isAutoScrollBlocked);
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isAutoScrollBlocked]);

  const stickToBottomIfNeeded = useCallback(() => {
    if (isAutoScrollBlocked()) return;
    const el = scrollRef.current;
    if (!el || !shouldStickRef.current) return;
    scrollContainerToBottom(el);
  }, [isAutoScrollBlocked]);

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
    if (suppressAutoScroll) {
      shouldStickRef.current = false;
      setIsNearBottom(false);
    }
  }, [suppressAutoScroll]);

  useEffect(() => {
    if (suppressAutoScrollRef.current) {
      shouldStickRef.current = false;
      setIsNearBottom(false);
      prevMessageMetaRef.current = { conversationId, length: messageCount };
      return;
    }
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
      if (suppressAutoScroll) {
        prevMessageMetaRef.current = { conversationId, length: messageCount };
        return;
      }
      if (prev.length === 0) {
        scrollToBottom("auto");
      } else if (shouldStickRef.current) {
        scrollToBottom("smooth");
      }
    }

    prevMessageMetaRef.current = { conversationId, length: messageCount };
  }, [conversationId, messageCount, scrollToBottom, suppressAutoScroll]);

  useEffect(() => {
    const finishedLoading = wasLoadingRef.current && !isLoadingMessages;
    wasLoadingRef.current = isLoadingMessages;
    if (!finishedLoading || messageCount === 0) return;
    if (isAutoScrollBlocked()) return;
    scrollToBottom("auto");
  }, [isLoadingMessages, messageCount, scrollToBottom, isAutoScrollBlocked]);

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
    holdAutoScroll,
  };
}
