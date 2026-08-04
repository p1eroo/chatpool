import { useEffect, useRef } from "react";
import { getAccessToken } from "@/api/client";
import { env } from "@/config/env";
import { requestAppUpdateCheck } from "@/config/appVersion";
import { notifyIncomingMessage } from "@/lib/incomingMessageNotifications";
import { buildRealtimeUrl, type RealtimeEvent } from "@/lib/realtime";
import { parseConversation, parseMessage } from "@/lib/parseApiDates";
import { refreshConversationsFromApi } from "@/services/bootstrapService";
import { useAuthStore } from "@/store/authStore";
import { useConversationStore } from "@/store/conversationStore";

const RECONNECT_MS = 3_000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
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
        // Tras un deploy el API se reinicia y el WS reconecta: una sola lectura de version.json.
        requestAppUpdateCheck();

        const { isAppDataBootstrapped } = useConversationStore.getState();
        if (isAppDataBootstrapped) {
          void refreshConversationsFromApi();
        }
        return;
      }

      if (event.type === "message.created") {
        const message = parseMessage(event.payload.message as never);
        const conversation = parseConversation(event.payload.conversation as never);

        useConversationStore.getState().applyRealtimeMessage(message, conversation);
        notifyIncomingMessage(message, conversation.id);
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
      }
    };

    const connect = () => {
      if (closed) return;

      const token = getAccessToken();
      if (!token) {
        scheduleReconnect();
        return;
      }

      socket?.close();
      socket = new WebSocket(buildRealtimeUrl(env.apiUrl, token));

      socket.onopen = () => {
        clearReconnectTimer();
      };

      socket.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data as string) as RealtimeEvent;
          handleEvent(data);
        } catch {
          // ignore malformed payloads
        }
      };

      socket.onclose = () => {
        socket = null;
        scheduleReconnect();
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      clearReconnectTimer();
      socket?.close();
      socket = null;
    };
  }, [isAuthenticated]);

  return children;
}
