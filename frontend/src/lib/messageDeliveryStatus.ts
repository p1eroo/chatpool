import type { Message } from "@/types";

/** Ids optimistas locales, antes de que el backend acepte el POST (201). */
export const LOCAL_PENDING_MESSAGE_PREFIX = "pending-";

export function isLocalPendingMessageId(id: string): boolean {
  return id.startsWith(LOCAL_PENDING_MESSAGE_PREFIX);
}

const DELIVERY_RANK: Record<NonNullable<Message["status"]>, number> = {
  failed: -1,
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

/**
 * `pending` en servidor = en cola hacia Meta, no “aún no enviado”.
 * Visualmente eso equivale a `sent`; el reloj queda solo para el pending local.
 */
export function visualDeliveryStatus(
  message: Pick<Message, "id" | "status">
): Message["status"] | undefined {
  if (message.status === "pending" && !isLocalPendingMessageId(message.id)) {
    return "sent";
  }
  return message.status;
}

/**
 * Al reconciliar 201/WS: el pending del servidor se trata como aceptado (`sent`)
 * y no se baja un estado de entrega ya confirmado (salvo `failed`).
 */
export function mergeDeliveryStatus(
  localStatus: Message["status"] | undefined,
  serverStatus: Message["status"] | undefined
): Message["status"] | undefined {
  if (serverStatus === "failed") return "failed";

  const acceptedServer = serverStatus === "pending" ? "sent" : serverStatus;
  if (!acceptedServer) return localStatus;
  if (!localStatus || localStatus === "pending" || localStatus === "failed") {
    return acceptedServer;
  }

  const localRank = DELIVERY_RANK[localStatus] ?? 0;
  const serverRank = DELIVERY_RANK[acceptedServer] ?? 0;
  return serverRank >= localRank ? acceptedServer : localStatus;
}
