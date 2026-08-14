import { useEffect, useRef } from "react";
import { env } from "@/config/env";
import { sendRealtimeEvent } from "@/lib/realtimeClient";

const TYPING_HEARTBEAT_MS = 2_000;
const TYPING_IDLE_MS = 2_000;

function emitTyping(conversationId: string, isTyping: boolean): boolean {
  return sendRealtimeEvent({
    type: "conversation.typing",
    payload: { conversationId, isTyping },
  });
}

/** Avisa a otros agentes mientras hay texto en el compositor (no notas privadas). */
export function useAgentTypingEmitter(
  conversationId: string | null,
  draft: string,
  enabled: boolean
): void {
  const typingRef = useRef(false);
  const lastHeartbeatRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (env.useMock || !conversationId) return undefined;

    return () => {
      if (!typingRef.current) return;
      typingRef.current = false;
      lastHeartbeatRef.current = 0;
      emitTyping(conversationId, false);
    };
  }, [conversationId]);

  useEffect(() => {
    if (env.useMock) return undefined;

    const composing = Boolean(conversationId) && enabled && draft.trim().length > 0;

    if (!conversationId || !composing) {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (conversationId && typingRef.current) {
        typingRef.current = false;
        lastHeartbeatRef.current = 0;
        emitTyping(conversationId, false);
      }
      return undefined;
    }

    const now = Date.now();
    if (!typingRef.current || now - lastHeartbeatRef.current >= TYPING_HEARTBEAT_MS) {
      if (emitTyping(conversationId, true)) {
        typingRef.current = true;
        lastHeartbeatRef.current = now;
      }
    }

    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = window.setTimeout(() => {
      if (!typingRef.current) return;
      typingRef.current = false;
      lastHeartbeatRef.current = 0;
      emitTyping(conversationId, false);
    }, TYPING_IDLE_MS);

    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [conversationId, draft, enabled]);
}
