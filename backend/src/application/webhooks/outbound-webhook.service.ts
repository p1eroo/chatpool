import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";

/** Eventos salientes estilo Chatwoot (v1). */
export const OUTGOING_WEBHOOK_EVENTS = [
  "message_created",
  "message_updated",
  "conversation_created",
  "conversation_updated",
  "conversation_status_changed",
  "conversation_bot_status_changed",
] as const;

export type OutgoingWebhookEvent = (typeof OUTGOING_WEBHOOK_EVENTS)[number];

const DELIVERY_TIMEOUT_MS = 10_000;

export type OutgoingWebhookDto = {
  id: string;
  inboxId: string;
  name: string | null;
  url: string;
  subscriptions: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

function isOutgoingWebhookEvent(value: string): value is OutgoingWebhookEvent {
  return (OUTGOING_WEBHOOK_EVENTS as readonly string[]).includes(value);
}

function assertSubscriptions(subscriptions: string[]): OutgoingWebhookEvent[] {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    throw new AppError("Selecciona al menos un evento", 400, "INVALID_SUBSCRIPTIONS");
  }

  const unique = [...new Set(subscriptions.map((item) => item.trim()).filter(Boolean))];
  for (const event of unique) {
    if (!isOutgoingWebhookEvent(event)) {
      throw new AppError(`Evento no soportado: ${event}`, 400, "INVALID_SUBSCRIPTIONS");
    }
  }

  return unique as OutgoingWebhookEvent[];
}

function assertUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError("URL de webhook inválida", 400, "INVALID_WEBHOOK_URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AppError("La URL debe usar http o https", 400, "INVALID_WEBHOOK_URL");
  }

  return trimmed;
}

async function assertInboxExists(inboxId: string): Promise<string> {
  const id = inboxId.trim();
  if (!id) {
    throw new AppError("inboxId es obligatorio", 400, "INVALID_INBOX");
  }

  const inbox = await prisma.inbox.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");
  return inbox.id;
}

function mapOutgoingWebhook(row: {
  id: string;
  inboxId: string;
  name: string | null;
  url: string;
  subscriptions: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): OutgoingWebhookDto {
  return {
    id: row.id,
    inboxId: row.inboxId,
    name: row.name,
    url: row.url,
    subscriptions: row.subscriptions,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toJsonSafe(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    console.error(
      "[outbound-webhook] payload no serializable:",
      error instanceof Error ? error.message : error
    );
    return { error: "payload_not_serializable" };
  }
}

export async function listOutgoingWebhooks(inboxId?: string): Promise<OutgoingWebhookDto[]> {
  const where = inboxId
    ? { inboxId: await assertInboxExists(inboxId) }
    : undefined;

  const rows = await prisma.outgoingWebhook.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapOutgoingWebhook);
}

export async function createOutgoingWebhook(input: {
  inboxId: string;
  url: string;
  name?: string | null;
  subscriptions: string[];
  enabled?: boolean;
}): Promise<OutgoingWebhookDto> {
  const inboxId = await assertInboxExists(input.inboxId);
  const url = assertUrl(input.url);
  const subscriptions = assertSubscriptions(input.subscriptions);
  const name = input.name?.trim() || null;

  const row = await prisma.outgoingWebhook.create({
    data: {
      inboxId,
      url,
      name,
      subscriptions,
      enabled: input.enabled ?? true,
    },
  });

  return mapOutgoingWebhook(row);
}

export async function updateOutgoingWebhook(
  id: string,
  input: {
    url?: string;
    name?: string | null;
    subscriptions?: string[];
    enabled?: boolean;
  }
): Promise<OutgoingWebhookDto> {
  const existing = await prisma.outgoingWebhook.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Webhook no encontrado");

  const data: {
    url?: string;
    name?: string | null;
    subscriptions?: string[];
    enabled?: boolean;
  } = {};

  if (input.url !== undefined) data.url = assertUrl(input.url);
  if (input.name !== undefined) data.name = input.name?.trim() || null;
  if (input.subscriptions !== undefined) {
    data.subscriptions = assertSubscriptions(input.subscriptions);
  }
  if (input.enabled !== undefined) data.enabled = input.enabled;

  if (Object.keys(data).length === 0) {
    throw new AppError("No hay campos para actualizar", 400, "INVALID_UPDATE");
  }

  const row = await prisma.outgoingWebhook.update({
    where: { id },
    data,
  });

  return mapOutgoingWebhook(row);
}

export async function deleteOutgoingWebhook(id: string): Promise<void> {
  const existing = await prisma.outgoingWebhook.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Webhook no encontrado");
  await prisma.outgoingWebhook.delete({ where: { id } });
}

async function deliverToWebhook(params: {
  url: string;
  event: OutgoingWebhookEvent;
  payload: Record<string, unknown>;
}): Promise<void> {
  const body = toJsonSafe({
    event: params.event,
    ...params.payload,
  });
  const rawBody = JSON.stringify(body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const response = await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Chatpool-Webhooks/1.0",
        "X-Chatpool-Event": params.event,
      },
      body: rawBody,
      signal: controller.signal,
    });

    const responseText = await response.text().catch(() => "");
    if (!response.ok) {
      console.error(
        `[outbound-webhook] ${params.event} → ${params.url} status=${response.status} body=${responseText.slice(0, 200)}`
      );
      return;
    }

    console.info(
      `[outbound-webhook] delivered ${params.event} → ${params.url} status=${response.status}`
    );
  } catch (error) {
    console.error(
      `[outbound-webhook] ${params.event} → ${params.url} failed:`,
      error instanceof Error ? error.message : error
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Encola entregas fire-and-forget a webhooks de la bandeja suscritos al evento.
 * No bloquea el flujo principal (mensajes / realtime).
 */
export function dispatchOutgoingWebhook(
  event: OutgoingWebhookEvent,
  payload: Record<string, unknown>,
  inboxId: string
): void {
  if (!inboxId) {
    console.warn(`[outbound-webhook] skip ${event}: missing inboxId`);
    return;
  }

  void (async () => {
    try {
      const webhooks = await prisma.outgoingWebhook.findMany({
        where: {
          inboxId,
          enabled: true,
          subscriptions: { has: event },
        },
        select: { id: true, url: true },
      });

      if (webhooks.length === 0) {
        console.info(
          `[outbound-webhook] no subscribers for ${event} inbox=${inboxId}`
        );
        return;
      }

      console.info(
        `[outbound-webhook] dispatch ${event} inbox=${inboxId} targets=${webhooks.length}`
      );

      await Promise.all(
        webhooks.map((webhook) =>
          deliverToWebhook({
            url: webhook.url,
            event,
            payload,
          })
        )
      );
    } catch (error) {
      console.error(
        `[outbound-webhook] dispatch ${event} failed:`,
        error instanceof Error ? error.message : error
      );
    }
  })();
}
