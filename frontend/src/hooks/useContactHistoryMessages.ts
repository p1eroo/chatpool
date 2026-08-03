import { useEffect, useMemo, useState } from "react";
import { env } from "@/config/env";
import { getMessages } from "@/data/mock";
import { sortMessagesChronologically } from "@/lib/messageOrder";
import { conversationApiService } from "@/services/conversationApiService";
import { useConversationStore } from "@/store/conversationStore";
import type { Conversation, Message } from "@/types";

async function loadConversationMessages(conversationId: string): Promise<Message[]> {
  const state = useConversationStore.getState();
  const cached = state.messages[conversationId] ?? [];

  if (env.useMock) {
    if (cached.length > 0) return cached;
    const messages = getMessages(conversationId);
    useConversationStore.setState((s) => ({
      messages: { ...s.messages, [conversationId]: messages },
    }));
    return messages;
  }

  if (state.messagesLoadedFromApi[conversationId]) {
    return cached;
  }

  const messages = await conversationApiService.getMessages(conversationId);

  useConversationStore.setState((s) => ({
    messages: { ...s.messages, [conversationId]: messages },
    messagesLoadedFromApi: { ...s.messagesLoadedFromApi, [conversationId]: true },
  }));

  return messages;
}

function conversationNeedsFetch(conversationId: string): boolean {
  const state = useConversationStore.getState();
  const cached = state.messages[conversationId] ?? [];

  if (env.useMock) return cached.length === 0;
  return !state.messagesLoadedFromApi[conversationId];
}

export function useContactHistoryMessages(
  conversations: Conversation[],
  enabled: boolean
) {
  const allMessages = useConversationStore((s) => s.messages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const conversationIds = useMemo(
    () => conversations.map((conversation) => conversation.id).join(","),
    [conversations]
  );

  useEffect(() => {
    if (!enabled || conversations.length === 0) {
      setLoading(false);
      setError(false);
      return;
    }

    const pending = conversations.filter((conversation) =>
      conversationNeedsFetch(conversation.id)
    );

    if (pending.length === 0) {
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    void Promise.all(pending.map((conversation) => loadConversationMessages(conversation.id)))
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, conversationIds, conversations]);

  const contactMessages = useMemo(() => {
    if (!enabled || conversations.length === 0) return [];

    const merged = conversations.flatMap(
      (conversation) => allMessages[conversation.id] ?? []
    );

    return sortMessagesChronologically(
      merged.filter(
        (message) => message.senderType === "contact" && !message.isPrivate
      )
    ).reverse();
  }, [enabled, conversations, allMessages]);

  return { contactMessages, loading, error };
}
