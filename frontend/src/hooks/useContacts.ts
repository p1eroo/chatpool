import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/env";
import { getContactsForInbox } from "@/data/mock";
import {
  contactApiService,
  type UpdateContactInput,
} from "@/services/contactApiService";
import { useConversationStore } from "@/store/conversationStore";
import type { Contact } from "@/types";

export const contactKeys = {
  all: ["contacts"] as const,
  list: () => [...contactKeys.all, "list"] as const,
};

function applyContactToConversations(contact: Contact) {
  useConversationStore.setState((state) => ({
    conversations: state.conversations.map((conversation) =>
      conversation.contact.id === contact.id
        ? { ...conversation, contact: { ...conversation.contact, ...contact } }
        : conversation
    ),
  }));
}

function removeContactFromConversations(contactId: string) {
  useConversationStore.setState((state) => {
    const removedIds = new Set(
      state.conversations
        .filter((conversation) => conversation.contact.id === contactId)
        .map((conversation) => conversation.id)
    );

    if (removedIds.size === 0) return state;

    const messages = { ...state.messages };
    const messagesLoadedFromApi = { ...state.messagesLoadedFromApi };
    const messagesLoading = { ...state.messagesLoading };

    for (const id of removedIds) {
      delete messages[id];
      delete messagesLoadedFromApi[id];
      delete messagesLoading[id];
    }

    return {
      conversations: state.conversations.filter(
        (conversation) => conversation.contact.id !== contactId
      ),
      messages,
      messagesLoadedFromApi,
      messagesLoading,
      activeConversationId:
        state.activeConversationId && removedIds.has(state.activeConversationId)
          ? null
          : state.activeConversationId,
    };
  });
}

export function useContacts() {
  return useQuery({
    queryKey: contactKeys.list(),
    queryFn: async () => {
      if (env.useMock) {
        return getContactsForInbox(null);
      }
      return contactApiService.list();
    },
    staleTime: 30_000,
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      patch,
    }: {
      contactId: string;
      patch: UpdateContactInput;
    }) => {
      if (env.useMock) {
        const list = queryClient.getQueryData<Contact[]>(contactKeys.list()) ?? [];
        const current = list.find((item) => item.id === contactId);
        if (!current) throw new Error("Contacto no encontrado");
        return { ...current, ...patch } as Contact;
      }
      return contactApiService.update(contactId, patch);
    },
    onSuccess: (contact) => {
      queryClient.setQueryData<Contact[]>(contactKeys.list(), (prev = []) =>
        prev.map((item) => (item.id === contact.id ? contact : item))
      );
      applyContactToConversations(contact);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      if (!env.useMock) {
        await contactApiService.remove(contactId);
      }
      return contactId;
    },
    onSuccess: (contactId) => {
      queryClient.setQueryData<Contact[]>(contactKeys.list(), (prev = []) =>
        prev.filter((item) => item.id !== contactId)
      );
      removeContactFromConversations(contactId);
    },
  });
}
