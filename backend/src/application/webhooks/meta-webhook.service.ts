import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import {
  broadcastMessageCreated,
  emitConversationUpdated,
  emitMessageUpdated,
} from "../realtime/realtime.service.js";
import {
  conversationMessageEmitSelect,
  mapConversationMessageEmit,
  messageCreateInclude,
  type ConversationMessageEmitRow,
} from "../realtime/conversation-realtime-emit.js";
import {
  resolveMetaApiFailure,
  resolveMetaWebhookStatusFailure,
} from "../../shared/meta-api-errors.js";
import {
  downloadAndStoreMetaMedia,
} from "../media/meta-media.service.js";
import { mapMessage, messageInclude } from "../mappers.js";
import { scheduleLinkPreviewEnrichment } from "../link-preview/link-preview-enrichment.service.js";
import {
  enrichWhatsAppContactPhone,
  processSmbAppStateSync,
  upsertWhatsAppContact,
} from "../contacts/whatsapp-contact-sync.service.js";
import {
  getInboundContactContext,
  patchInboundContactConversationBase,
  setInboundContactContext,
} from "../contacts/inbound-contact-context-cache.js";
import {
  classifyConversationIntoMiniInbox,
  findOrReopenConversationForContact,
} from "../conversations/conversations.service.js";
import {
  recordContactSharedPhoneActivity,
} from "../conversations/conversation-activity.service.js";
import {
  computeInboundQueueSortKey,
  scheduleInboundContactTask,
} from "../conversations/inbound-contact-queue.js";
import { runWithConversationMessageLock } from "../conversations/conversation-message-serializer.js";
import { computeInboundMessageSortOrder } from "../conversations/message-sort-order.js";
import { parseMetaMessageTimestamp } from "../../shared/meta-message-time.js";
import { noteContactMessageAt } from "../../shared/whatsapp-window.js";
import {
  emitInboundProvisionalIfNeeded,
  parseInboundWebhookContent,
  shouldIgnoreInboundMessageType,
  tryEmitInboundProvisionalFast,
} from "./inbound-provisional-message.js";
import {
  resolveInboundWhatsAppIdentity,
  sanitizeWhatsAppDisplayName,
} from "../../shared/whatsapp-contact.js";
import { resolveContactRequestPhone, isInboundContactsMessage } from "../../shared/whatsapp-shared-contact.js";

interface MetaMediaPayload {
  id?: string;
  mime_type?: string;
  filename?: string;
  caption?: string;
}

interface MetaWebhookContact {
  profile?: { name?: string; username?: string };
  wa_id?: string;
  user_id?: string;
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: MetaWebhookContact[];
        messages?: Array<{
          id?: string;
          from?: string;
          from_user_id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          context?: { from?: string; id?: string };
          document?: MetaMediaPayload;
          image?: MetaMediaPayload;
          audio?: MetaMediaPayload;
          voice?: MetaMediaPayload;
          video?: MetaMediaPayload;
          sticker?: MetaMediaPayload;
          contacts?: Array<{
            name?: { formatted_name?: string; first_name?: string };
            phones?: Array<{ phone?: string; wa_id?: string; type?: string }>;
            origin?: string | { type?: string };
            vcard?: string;
          }>;
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
          recipient_user_id?: string;
        }>;
        state_sync?: Array<{
          type?: string;
          action?: string;
          contact?: {
            full_name?: string;
            first_name?: string;
            phone_number?: string;
          };
        }>;
      };
    }>;
  }>;
}

export function verifyMetaChallenge(params: {
  mode?: string;
  verifyToken?: string;
  challenge?: string;
  expectedToken?: string | null;
}): string | null {
  if (params.mode !== "subscribe" || !params.challenge) return null;
  if (!params.expectedToken || params.verifyToken !== params.expectedToken) return null;
  return params.challenge;
}

const inboxWebhookInclude = {
  inbox: { include: { inboxAgents: true } },
} as const;

/** Elimina conversación vacía creada por doble webhook / carrera de wamid. */
async function deleteEmptyConversationIfUnused(conversationId: string): Promise<void> {
  const empty = await prisma.conversation.findFirst({
    where: { id: conversationId, messages: { none: {} } },
    select: { id: true, contactId: true },
  });
  if (!empty) return;

  await prisma.conversation.delete({ where: { id: empty.id } });

  const remaining = await prisma.conversation.count({
    where: { contactId: empty.contactId },
  });
  if (remaining === 0) {
    await prisma.contact.delete({ where: { id: empty.contactId } }).catch(() => undefined);
  }
}

/**
 * Resuelve la bandeja del webhook Meta.
 * `phone_number_id` manda (como Chatwoot): evita que un evento de Facturación
 * procesado en la URL de Call center cree un hilo fantasma en la bandeja equivocada.
 */
export async function resolveInboxForMetaWebhook(inboxId?: string, phoneNumberId?: string) {
  const normalizedPhoneNumberId = phoneNumberId?.trim() || undefined;
  const normalizedInboxId = inboxId?.trim() || undefined;

  if (normalizedPhoneNumberId) {
    const byPhone = await prisma.inboxSettings.findFirst({
      where: { phoneNumberId: normalizedPhoneNumberId },
      include: inboxWebhookInclude,
    });

    if (!byPhone) {
      console.warn(
        `[webhook] phone_number_id=${normalizedPhoneNumberId} sin bandeja; se ignora inboxId URL=${normalizedInboxId ?? "-"}`
      );
      return null;
    }

    if (normalizedInboxId && byPhone.inboxId !== normalizedInboxId) {
      console.warn(
        `[webhook] mismatch URL inboxId=${normalizedInboxId} vs phone_number_id=${normalizedPhoneNumberId} → bandeja ${byPhone.inbox.name} (${byPhone.inboxId})`
      );
    }

    return byPhone;
  }

  if (normalizedInboxId) {
    return prisma.inboxSettings.findUnique({
      where: { inboxId: normalizedInboxId },
      include: inboxWebhookInclude,
    });
  }

  return null;
}

type MetaStatusEvent = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  recipient_user_id?: string;
  errors?: unknown;
};

function mapMetaDeliveryStatus(status?: string): "sent" | "delivered" | "read" | "failed" | null {
  if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
    return status;
  }
  return null;
}

async function processMetaMessageStatuses(
  inboxId: string,
  statuses: MetaStatusEvent[] | undefined,
  contacts?: MetaWebhookContact[]
): Promise<number> {
  let processed = 0;

  for (const statusEvent of statuses ?? []) {
    if (!statusEvent.id) continue;

    const nextStatus = mapMetaDeliveryStatus(statusEvent.status);
    if (!nextStatus) continue;

    const message = await prisma.message.findUnique({
      where: { externalId: statusEvent.id },
      select: { id: true, conversationId: true, status: true, errorMessage: true },
    });

    if (!message) continue;

    const failure =
      nextStatus === "failed"
        ? resolveMetaWebhookStatusFailure(statusEvent.errors)
        : null;
    const nextErrorMessage =
      nextStatus === "failed"
        ? failure?.message ?? message.errorMessage ?? "No se pudo entregar el mensaje por WhatsApp"
        : null;

    if (message.status === nextStatus && message.errorMessage === nextErrorMessage) continue;

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        status: nextStatus,
        errorMessage: nextErrorMessage,
      },
      include: messageInclude,
    });

    await emitMessageUpdated(message.conversationId, message.id, updated);
    processed += 1;
  }

  // Enriquecer teléfono si Meta lo revela en statuses (envíos a BSUID).
  for (const contact of contacts ?? []) {
    await enrichWhatsAppContactPhone({
      inboxId,
      phone: contact.wa_id,
      userId: contact.user_id,
      profileName: contact.profile?.name,
    });
  }

  for (const statusEvent of statuses ?? []) {
    if (!statusEvent.recipient_id && !statusEvent.recipient_user_id) continue;
    await enrichWhatsAppContactPhone({
      inboxId,
      phone: statusEvent.recipient_id,
      userId: statusEvent.recipient_user_id,
    });
  }

  return processed;
}

/** Descarga media de Meta fuera del camino crítico; el adjunto lazy ya cubre el click temprano. */
function scheduleIncomingMediaHydration(params: {
  messageId: string;
  conversationId: string;
  accessToken: string;
  mediaId: string;
  fileName: string;
  mimeType: string;
}) {
  void (async () => {
    try {
      const stored = await downloadAndStoreMetaMedia({
        conversationId: params.conversationId,
        accessToken: params.accessToken,
        mediaId: params.mediaId,
        fileName: params.fileName,
        mimeType: params.mimeType,
      });

      const updated = await prisma.message.update({
        where: { id: params.messageId },
        data: {
          fileKey: stored.fileKey,
          fileSize: stored.fileSize,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
        },
        include: messageInclude,
      });

      await emitMessageUpdated(params.conversationId, updated.id, updated);
    } catch (error) {
      const failure = resolveMetaApiFailure(error);
      console.error("No se pudo hidratar media de Meta:", failure.message);
    }
  })();
}

export interface MetaWebhookProcessedEvent {
  kind: "message" | "status" | "contact_sync";
  contactName?: string;
  contactPhone?: string;
  contentPreview?: string;
  conversationId?: string;
  messageId?: string;
  inboxId?: string;
  inboxName?: string;
  status?: string;
  syncedContacts?: number;
}

type InboxWebhookSettings = NonNullable<Awaited<ReturnType<typeof resolveInboxForMetaWebhook>>>;

type MetaInboundMessage = NonNullable<
  NonNullable<
    NonNullable<MetaWebhookPayload["entry"]>[number]["changes"]
  >[number]["value"]
>["messages"] extends (infer M)[] | undefined
  ? M
  : never;

async function processInboundMetaMessage(params: {
  settings: InboxWebhookSettings;
  message: MetaInboundMessage;
  batchIndex: number;
  contacts?: MetaWebhookContact[];
  accessToken: string | null;
}): Promise<MetaWebhookProcessedEvent | null> {
  const { settings, message, batchIndex, contacts, accessToken } = params;
  if (!message.id) return null;
  if (shouldIgnoreInboundMessageType(message.type)) return null;

  // Deduplicar por wamid ANTES de crear contacto/conversación.
  // Si el mismo evento llega a dos URLs de bandeja, evita cards "Sin mensajes".
  const existing = await prisma.message.findUnique({
    where: { externalId: message.id },
    select: { id: true },
  });
  if (existing) return null;

  const matchedContact =
    contacts?.find(
      (c) =>
        (message.from && c.wa_id === message.from) ||
        (message.from_user_id && c.user_id === message.from_user_id)
    ) ?? contacts?.[0];

  const identity = resolveInboundWhatsAppIdentity({
    from: message.from,
    fromUserId: message.from_user_id,
    contact: matchedContact,
  });

  if (!identity) {
    console.error(
      `[webhook] sin identidad from=${message.from ?? "-"} from_user_id=${message.from_user_id ?? "-"} msg=${message.id}`
    );
    return null;
  }

  tryEmitInboundProvisionalFast({
    inboxId: settings.inboxId,
    identityKey: identity.identityKey,
    message,
  });

  const contactName = sanitizeWhatsAppDisplayName(
    identity.displayName,
    identity.phone || identity.identityKey
  );

  const alternateIdentityKeys = [
    message.from_user_id,
    matchedContact?.user_id,
    message.from && message.from !== identity.identityKey ? message.from : null,
  ].filter((value): value is string => Boolean(value?.trim()));

  const sharedPhone = isInboundContactsMessage(message)
    ? resolveContactRequestPhone(message.contacts)
    : null;

  let previousPhone =
    getInboundContactContext(settings.inboxId, identity.identityKey)?.conversationBase.contact
      .phone ?? null;

  if (sharedPhone && !previousPhone) {
    const existing = await prisma.contact.findUnique({
      where: {
        inboxId_waId: {
          inboxId: settings.inboxId,
          waId: identity.identityKey,
        },
      },
      select: { phone: true },
    });
    previousPhone = existing?.phone ?? null;
  }

  const contact = await upsertWhatsAppContact(settings.inboxId, {
    waId: identity.identityKey,
    phone: sharedPhone ?? identity.phone,
    alternateIdentityKeys,
    name: contactName,
    touchLastSeen: true,
  });

  if (!contact) {
    console.error(
      `[webhook] no se pudo upsert contacto identity=${identity.identityKey} msg=${message.id}`
    );
    return null;
  }

  if (contact.isBlocked) return null;

  const cachedContext = getInboundContactContext(settings.inboxId, identity.identityKey);

  if (cachedContext && cachedContext.contactId === contact.id) {
    patchInboundContactConversationBase(settings.inboxId, identity.identityKey, {
      contact: {
        ...cachedContext.conversationBase.contact,
        phone: contact.phone,
        waId: contact.waId,
        name: contact.name,
      },
    });
  }

  const resolveConversation = async (): Promise<{
    conversationId: string;
    conversationBase: ConversationMessageEmitRow | null;
    created: boolean;
  }> => {
    if (cachedContext && cachedContext.contactId === contact.id) {
      return {
        conversationId: cachedContext.conversationId,
        conversationBase: cachedContext.conversationBase,
        created: false,
      };
    }

    const { conversation, created } = await findOrReopenConversationForContact({
      inboxId: settings.inboxId,
      contactId: contact.id,
      autoAssign: true,
    });

    const conversationBase = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      select: conversationMessageEmitSelect,
    });

    if (conversationBase) {
      setInboundContactContext({
        inboxId: settings.inboxId,
        identityKey: identity.identityKey,
        contactId: contact.id,
        contactName,
        conversationId: conversation.id,
        conversationBase,
      });
    }

    return { conversationId: conversation.id, conversationBase, created };
  };

  const [{ conversationId, conversationBase }, replyTarget] =
    await Promise.all([
    resolveConversation(),
    message.context?.id
      ? prisma.message.findUnique({
          where: { externalId: message.context.id },
          select: { id: true, conversationId: true },
        })
      : Promise.resolve(null),
  ]);

  // Carrera: otro worker pudo persistir el mismo wamid mientras resolvíamos la conversación.
  const existingAfterResolve = await prisma.message.findUnique({
    where: { externalId: message.id },
    select: { id: true },
  });
  if (existingAfterResolve) {
    await deleteEmptyConversationIfUnused(conversationId);
    return null;
  }

  let replyToMessageId: string | null = null;
  if (replyTarget?.conversationId === conversationId) {
    replyToMessageId = replyTarget.id;
  }

  const { content, contentType, fileName, mimeType, mediaExternalId, location } =
    parseInboundWebhookContent(message.id, message);
  const shouldHydrateMedia = Boolean(
    mediaExternalId && accessToken && contentType !== "location"
  );

  const messageAt = parseMetaMessageTimestamp(message.timestamp);

  if (conversationBase) {
    emitInboundProvisionalIfNeeded({
      inboxId: settings.inboxId,
      identityKey: identity.identityKey,
      externalId: message.id,
      conversationId,
      contactId: contact.id,
      contactName,
      conversationBase,
      message,
    });
  }

  let createdMessageId: string | null = null;

  try {
    const locked = await runWithConversationMessageLock(conversationId, async () => {
      const raced = await prisma.message.findUnique({
        where: { externalId: message.id },
        select: { id: true },
      });
      if (raced) return { createdMessageId: null as string | null };

      const sortOrder = await computeInboundMessageSortOrder(
        conversationId,
        message.timestamp,
        batchIndex
      );

      const created = await prisma.message.create({
        data: {
          conversationId,
          content,
          senderType: "contact",
          senderContactId: contact.id,
          senderName: contactName,
          contentType,
          fileName,
          fileSize: null,
          fileKey: null,
          mimeType,
          mediaExternalId,
          location: location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                ...(location.name ? { name: location.name } : {}),
                ...(location.address ? { address: location.address } : {}),
              }
            : undefined,
          externalId: message.id,
          replyToMessageId,
          status: "delivered",
          createdAt: messageAt,
          sortOrder,
        },
        include: messageCreateInclude(replyToMessageId),
      });

      const conversationRow = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: messageAt,
        },
        select: conversationMessageEmitSelect,
      });

      patchInboundContactConversationBase(settings.inboxId, identity.identityKey, conversationRow);

      broadcastMessageCreated(
        mapMessage(created),
        mapConversationMessageEmit(conversationRow, created)
      );

      return { createdMessageId: created.id as string | null };
    });
    createdMessageId = locked.createdMessageId;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await deleteEmptyConversationIfUnused(conversationId);
      return null;
    }
    throw error;
  }

  if (!createdMessageId) {
    await deleteEmptyConversationIfUnused(conversationId);
    return null;
  }

  noteContactMessageAt(conversationId, messageAt);

  // Auto-clasificación de bandejitas: solo mensajes entrantes de contacto.
  // No hace nada si ya tiene bandejita o no coincide ninguna frase.
  await classifyConversationIntoMiniInbox(conversationId, content);

  if (shouldHydrateMedia && mediaExternalId && accessToken) {
    scheduleIncomingMediaHydration({
      messageId: createdMessageId,
      conversationId,
      accessToken,
      mediaId: mediaExternalId,
      fileName: fileName ?? `${contentType}-${message.id.slice(0, 8)}`,
      mimeType: mimeType ?? "application/octet-stream",
    });
  }

  scheduleLinkPreviewEnrichment({
    messageId: createdMessageId,
    conversationId,
    content,
    contentType,
  });

  const phoneJustShared = Boolean(sharedPhone && !previousPhone);
  if (phoneJustShared && sharedPhone) {
    await recordContactSharedPhoneActivity(conversationId, sharedPhone);
    await emitConversationUpdated(conversationId);
  }

  return {
    kind: "message",
    contactName,
    contactPhone: identity.phone || identity.identityKey,
    contentPreview: content.slice(0, 120),
    conversationId,
    messageId: createdMessageId,
    inboxId: settings.inboxId,
    inboxName: settings.inbox.name,
  };
}

export async function processMetaWebhookPayload(
  payload: MetaWebhookPayload,
  inboxId?: string
): Promise<{ processed: number; events: MetaWebhookProcessedEvent[] }> {
  let processed = 0;
  const events: MetaWebhookProcessedEvent[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      const settings = await resolveInboxForMetaWebhook(inboxId, phoneNumberId);

      if (!settings) continue;

      if (change.field === "smb_app_state_sync") {
        const syncedContacts = await processSmbAppStateSync(
          settings.inboxId,
          value.state_sync ?? []
        );

        if (syncedContacts > 0) {
          events.push({
            kind: "contact_sync",
            inboxId: settings.inboxId,
            inboxName: settings.inbox.name,
            syncedContacts,
          });
        }

        processed += syncedContacts;
        continue;
      }

      if (change.field !== "messages") continue;

      const accessToken = settings.accessToken?.trim() || null;
      const inboundTasks: Promise<void>[] = [];

      for (let batchIndex = 0; batchIndex < (value.messages ?? []).length; batchIndex++) {
        const message = value.messages![batchIndex];
        if (!message?.id) continue;

        const matchedContact =
          value.contacts?.find(
            (c) =>
              (message.from && c.wa_id === message.from) ||
              (message.from_user_id && c.user_id === message.from_user_id)
          ) ?? value.contacts?.[0];

        const identity = resolveInboundWhatsAppIdentity({
          from: message.from,
          fromUserId: message.from_user_id,
          contact: matchedContact,
        });

        if (!identity) {
          console.error(
            `[webhook] sin identidad from=${message.from ?? "-"} from_user_id=${message.from_user_id ?? "-"} msg=${message.id}`
          );
          continue;
        }

        tryEmitInboundProvisionalFast({
          inboxId: settings.inboxId,
          identityKey: identity.identityKey,
          message,
        });

        inboundTasks.push(
          scheduleInboundContactTask(
            settings.inboxId,
            identity.identityKey,
            computeInboundQueueSortKey(message.timestamp, batchIndex),
            async () => {
              try {
                const event = await processInboundMetaMessage({
                  settings,
                  message,
                  batchIndex,
                  contacts: value.contacts,
                  accessToken,
                });
                if (!event) return;
                events.push(event);
                processed += 1;
              } catch (error) {
                console.error(
                  `[webhook] error procesando msg=${message.id} from=${message.from ?? message.from_user_id ?? "-"}:`,
                  error instanceof Error ? error.message : error
                );
              }
            }
          )
        );
      }

      processed += await processMetaMessageStatuses(
        settings.inboxId,
        value.statuses,
        value.contacts
      );

      await Promise.all(inboundTasks);
    }
  }

  return { processed, events };
}
