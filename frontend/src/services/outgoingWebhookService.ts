import { apiRequest } from "@/api/client";
import type {
  CreateOutgoingWebhookRequest,
  OutgoingWebhookDto,
  OutgoingWebhookEvent,
  UpdateOutgoingWebhookRequest,
} from "@/types/api";

export const OUTGOING_WEBHOOK_EVENT_OPTIONS: {
  id: OutgoingWebhookEvent;
  label: string;
  description: string;
}[] = [
  {
    id: "message_created",
    label: "message_created",
    description: "Cuando se crea un mensaje (entrante o saliente)",
  },
  {
    id: "message_updated",
    label: "message_updated",
    description: "Cuando cambia el estado de un mensaje (enviado, entregado, etc.)",
  },
  {
    id: "conversation_created",
    label: "conversation_created",
    description: "Cuando se abre una conversación nueva",
  },
  {
    id: "conversation_updated",
    label: "conversation_updated",
    description: "Cuando cambia una conversación (asignación, etiquetas, etc.)",
  },
  {
    id: "conversation_status_changed",
    label: "conversation_status_changed",
    description: "Cuando una conversación se abre o se resuelve",
  },
  {
    id: "conversation_bot_status_changed",
    label: "conversation_bot_status_changed",
    description: "Cuando el bot se enciende o se pausa en una conversación",
  },
];

export const outgoingWebhookService = {
  list(inboxId?: string): Promise<OutgoingWebhookDto[]> {
    const query = inboxId ? `?${new URLSearchParams({ inboxId }).toString()}` : "";
    return apiRequest<OutgoingWebhookDto[]>(`/outgoing-webhooks${query}`);
  },

  create(body: CreateOutgoingWebhookRequest): Promise<OutgoingWebhookDto> {
    return apiRequest<OutgoingWebhookDto>("/outgoing-webhooks", {
      method: "POST",
      body,
    });
  },

  update(id: string, body: UpdateOutgoingWebhookRequest): Promise<OutgoingWebhookDto> {
    return apiRequest<OutgoingWebhookDto>(`/outgoing-webhooks/${id}`, {
      method: "PATCH",
      body,
    });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>(`/outgoing-webhooks/${id}`, {
      method: "DELETE",
    });
  },
};
