import { create } from "zustand";
import { getCurrentAgentId } from "@/lib/authSession";
import { useConversationStore } from "@/store/conversationStore";
import type { AgentTypingEntry } from "@/lib/agentTyping";

const TYPING_EXPIRE_MS = 4_500;

const expireTimers = new Map<string, number>();

function timerKey(conversationId: string, agentId: string): string {
  return `${conversationId}:${agentId}`;
}

function clearExpireTimer(conversationId: string, agentId: string): void {
  const key = timerKey(conversationId, agentId);
  const timer = expireTimers.get(key);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    expireTimers.delete(key);
  }
}

interface AgentTypingState {
  byConversationId: Record<string, AgentTypingEntry[]>;
  applyTyping: (payload: {
    conversationId: string;
    agentId: string;
    agentName: string;
    isTyping: boolean;
  }) => void;
  clearAgentTyping: (conversationId: string, agentId: string) => void;
}

function removeTyper(
  current: Record<string, AgentTypingEntry[]>,
  conversationId: string,
  agentId: string
): Record<string, AgentTypingEntry[]> {
  const existing = current[conversationId];
  if (!existing?.some((item) => item.agentId === agentId)) return current;

  const nextTypers = existing.filter((item) => item.agentId !== agentId);
  const next = { ...current };
  if (nextTypers.length === 0) {
    delete next[conversationId];
  } else {
    next[conversationId] = nextTypers;
  }
  return next;
}

export const useAgentTypingStore = create<AgentTypingState>((set, get) => ({
  byConversationId: {},

  applyTyping: ({ conversationId, agentId, agentName, isTyping }) => {
    if (!conversationId || !agentId) return;
    if (agentId === getCurrentAgentId()) return;

    const known = useConversationStore
      .getState()
      .conversations.some((item) => item.id === conversationId);
    if (!known) return;

    clearExpireTimer(conversationId, agentId);

    if (!isTyping) {
      set((state) => ({
        byConversationId: removeTyper(state.byConversationId, conversationId, agentId),
      }));
      return;
    }

    const name = agentName.trim() || "Agente";
    const existing = get().byConversationId[conversationId] ?? [];
    const already = existing.find((item) => item.agentId === agentId);
    if (!already || already.agentName !== name) {
      const nextTypers = already
        ? existing.map((item) =>
            item.agentId === agentId ? { agentId, agentName: name } : item
          )
        : [...existing, { agentId, agentName: name }];

      set((state) => ({
        byConversationId: {
          ...state.byConversationId,
          [conversationId]: nextTypers,
        },
      }));
    }

    expireTimers.set(
      timerKey(conversationId, agentId),
      window.setTimeout(() => {
        expireTimers.delete(timerKey(conversationId, agentId));
        set((state) => ({
          byConversationId: removeTyper(state.byConversationId, conversationId, agentId),
        }));
      }, TYPING_EXPIRE_MS)
    );
  },

  clearAgentTyping: (conversationId, agentId) => {
    clearExpireTimer(conversationId, agentId);
    set((state) => ({
      byConversationId: removeTyper(state.byConversationId, conversationId, agentId),
    }));
  },
}));
