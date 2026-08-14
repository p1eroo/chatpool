import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "@/api/client";
import { env } from "@/config/env";
import { requestAppUpdateCheck } from "@/config/appVersion";
import {
  notifyIncomingMessage,
  shouldPlayIncomingMessageSound,
} from "@/lib/incomingMessageNotifications";
import { buildRealtimeUrl, type RealtimeEvent } from "@/lib/realtime";
import { setRealtimeSocket } from "@/lib/realtimeClient";
import { parseConversation, parseMessage } from "@/lib/parseApiDates";
import { refreshConversationsFromApi } from "@/services/bootstrapService";
import { useAuthStore } from "@/store/authStore";
import { useAgentTypingStore } from "@/store/agentTypingStore";
import { useConversationStore } from "@/store/conversationStore";

const RECONNECT_MS = 3_000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const forceLogout = useAuthStore((s) => s.forceLogout);
  const navigate = useNavigate();
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (env.useMock || !isAuthenticated) return;

    let closed = false;
    let socket: WebSocket | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed) return;
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_MS);
    };

    const handleEvent = (event: RealtimeEvent) => {
      if (event.type === "connected") {
        // Tras un deploy el API se reinicia y el WS reconecta: check forzado (sin throttle).
        requestAppUpdateCheck({ force: true });

        const { isAppDataBootstrapped } = useConversationStore.getState();
        if (isAppDataBootstrapped) {
          void refreshConversationsFromApi();
        }
        return;
      }

      if (event.type === "message.created") {
        const message = parseMessage(event.payload.message as never);
        const conversation = parseConversation(event.payload.conversation as never);

        // Evaluar antes de aplicar: el persistido reemplaza al provisional en el store.
        const playSound = shouldPlayIncomingMessageSound(
          message,
          conversation.id,
          conversation.inboxId
        );
        useConversationStore.getState().applyRealtimeMessage(message, conversation);
        if (message.senderType === "agent" && message.senderId) {
          useAgentTypingStore.getState().clearAgentTyping(conversation.id, message.senderId);
        }
        notifyIncomingMessage(message, conversation.id, {
          playSound,
          inboxId: conversation.inboxId,
        });
        return;
      }

      if (event.type === "message.updated") {
        useConversationStore.getState().applyRealtimeMessageUpdate(
          parseMessage(event.payload.message as never),
          event.payload.conversationId
        );
        return;
      }

      if (event.type === "conversation.updated") {
        useConversationStore.getState().applyRealtimeConversation(
          parseConversation(event.payload.conversation as never)
        );
        return;
      }

      if (event.type === "conversation.typing") {
        useAgentTypingStore.getState().applyTyping(event.payload);
      }
    };

    const connect = () => {
      if (closed) return;

      const token = getAccessToken();
      if (!token) {
        scheduleReconnect();
        return;
      }

      const previous = socket;
      const next = new WebSocket(buildRealtimeUrl(env.apiUrl, token));
      socket = next;
      setRealtimeSocket(next);

      next.onopen = () => {
        clearReconnectTimer();
      };

      next.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data as string) as RealtimeEvent;
          handleEvent(data);
        } catch {
          // ignore malformed payloads
        }
      };

      next.onclose = (event) => {
        if (socket === next) {
          setRealtimeSocket(null);
          socket = null;
        }
        if (event.code === 4401) {
          forceLogout("SESSION_REVOKED");
          navigate("/login", { replace: true });
          return;
        }
        if (socket === next || socket === null) {
          scheduleReconnect();
        }
      };

      next.onerror = () => {
        next.close();
      };

      previous?.close();
    };

    connect();

    return () => {
      closed = true;
      clearReconnectTimer();
      setRealtimeSocket(null);
      socket?.close();
      socket = null;
    };
  }, [forceLogout, isAuthenticated, navigate]);

  return children;
}
