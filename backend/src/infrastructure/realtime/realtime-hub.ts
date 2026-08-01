import type { Conversation, Message } from "../../types/api-responses.js";

export type RealtimeEvent =
  | {
      type: "message.created";
      payload: {
        message: Message;
        conversation: Conversation;
      };
    }
  | {
      type: "message.updated";
      payload: {
        message: Message;
        conversationId: string;
      };
    }
  | {
      type: "conversation.updated";
      payload: {
        conversation: Conversation;
      };
    };

type RealtimeSocket = {
  send: (data: string) => void;
};

const clients = new Set<RealtimeSocket>();

export function registerRealtimeClient(client: RealtimeSocket): void {
  clients.add(client);
}

export function unregisterRealtimeClient(client: RealtimeSocket): void {
  clients.delete(client);
}

export function broadcastRealtime(event: RealtimeEvent): void {
  if (clients.size === 0) return;

  const payload = JSON.stringify(event);
  for (const client of clients) {
    try {
      client.send(payload);
    } catch {
      clients.delete(client);
    }
  }
}
