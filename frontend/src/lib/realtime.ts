import type { Conversation, Message } from "@/types";

export type RealtimeEvent =
  | { type: "connected" }
  | {
      type: "message.created";
      payload: {
        message: Message & { createdAt: string | Date };
        conversation: Conversation & {
          createdAt: string | Date;
          updatedAt: string | Date;
          lastMessage: (Message & { createdAt: string | Date }) | null;
        };
      };
    }
  | {
      type: "message.updated";
      payload: {
        message: Message & { createdAt: string | Date };
        conversationId: string;
      };
    }
  | {
      type: "conversation.updated";
      payload: {
        conversation: Conversation & {
          createdAt: string | Date;
          updatedAt: string | Date;
          lastMessage: (Message & { createdAt: string | Date }) | null;
        };
      };
    };

export function buildRealtimeUrl(apiUrl: string, token: string): string {
  const base = apiUrl.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
  return `${base.replace(/\/$/, "")}/realtime?token=${encodeURIComponent(token)}`;
}
