import { prisma } from "../../infrastructure/database/prisma.client.js";
import {
  conversationRealtimeInclude,
  emitMessageCreated,
  emitMessageUpdated,
} from "../realtime/realtime.service.js";
import { resolveMetaApiFailure } from "../../shared/meta-api-errors.js";
import {
  downloadAndStoreMetaMedia,
  parseIncomingMetaMedia,
} from "../media/meta-media.service.js";
import { messageInclude } from "../mappers.js";
import {
  enrichWhatsAppContactPhone,
  processSmbAppStateSync,
  upsertWhatsAppContact,
} from "../contacts/whatsapp-contact-sync.service.js";
import { findOrReopenConversationForContact } from "../conversations/conversations.service.js";
import { runWithConversationMessageLock } from "../conversations/conversation-message-serializer.js";
import { nextMessageSortOrder } from "../conversations/message-sort-order.js";
import { parseMetaMessageTimestamp } from "../../shared/meta-message-time.js";
import {
  resolveInboundWhatsAppIdentity,
  sanitizeWhatsAppDisplayName,
} from "../../shared/whatsapp-contact.js";

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

export async function resolveInboxForMetaWebhook(inboxId?: string, phoneNumberId?: string) {
  if (inboxId) {
    return prisma.inboxSettings.findUnique({
      where: { inboxId },
      include: { inbox: { include: { inboxAgents: true } } },
    });
  }

  if (phoneNumberId) {
    return prisma.inboxSettings.findFirst({
      where: { phoneNumberId },
      include: { inbox: { include: { inboxAgents: true } } },
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
      select: { id: true, conversationId: true, status: true },
    });

    if (!message || message.status === nextStatus) continue;

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { status: nextStatus },
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

      processed += await processMetaMessageStatuses(
        settings.inboxId,
        value.statuses,
        value.contacts
      );

      for (const message of value.messages ?? []) {
        if (!message.id) continue;

        try {
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

          const contactName = sanitizeWhatsAppDisplayName(
            identity.displayName,
            identity.phone || identity.identityKey
          );

          const alternateIdentityKeys = [
            message.from_user_id,
            matchedContact?.user_id,
            message.from && message.from !== identity.identityKey ? message.from : null,
          ].filter((value): value is string => Boolean(value?.trim()));

          const contact = await upsertWhatsAppContact(settings.inboxId, {
            waId: identity.identityKey,
            phone: identity.phone,
            alternateIdentityKeys,
            name: contactName,
            touchLastSeen: true,
          });

          if (!contact) {
            console.error(
              `[webhook] no se pudo upsert contacto identity=${identity.identityKey} msg=${message.id}`
            );
            continue;
          }

          if (contact.isBlocked) continue;

          // Conversaciones nuevas entran sin asignar; la asignación es manual.
          const { conversation } = await findOrReopenConversationForContact({
            inboxId: settings.inboxId,
            contactId: contact.id,
          });

          const existing = await prisma.message.findUnique({
            where: { externalId: message.id },
          });

          if (existing) continue;

          let replyToMessageId: string | null = null;
          if (message.context?.id) {
            const replied = await prisma.message.findUnique({
              where: { externalId: message.context.id },
              select: { id: true, conversationId: true },
            });
            if (replied?.conversationId === conversation.id) {
              replyToMessageId = replied.id;
            }
          }

          const parsed = parseIncomingMetaMedia(message.type, message.id, message);
          const fallbackContent = `[${message.type ?? "mensaje"}]`;
          let content = parsed?.content ?? fallbackContent;
          let contentType = parsed?.contentType ?? "text";
          let fileName: string | null = null;
          let mimeType: string | null = null;
          let mediaExternalId: string | null = parsed?.mediaId || null;
          const shouldHydrateMedia = Boolean(parsed?.mediaId && accessToken);

          if (parsed && parsed.contentType !== "text") {
            content = parsed.content || parsed.fileName || fallbackContent;
            contentType = parsed.contentType;
            fileName = parsed.fileName;
            mimeType = parsed.mimeType;
          }

          const messageAt = parseMetaMessageTimestamp(message.timestamp);

          const { createdMessage, conversationForEmit } = await runWithConversationMessageLock(
            conversation.id,
            async () => {
              const sortOrder = await nextMessageSortOrder(conversation.id);

              const created = await prisma.message.create({
                data: {
                  conversationId: conversation.id,
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
                  externalId: message.id,
                  replyToMessageId,
                  status: "delivered",
                  createdAt: messageAt,
                  sortOrder,
                },
                include: messageInclude,
              });

              const conversationRow = await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                  unreadCount: { increment: 1 },
                  lastMessageAt: messageAt,
                },
                include: conversationRealtimeInclude,
              });

              return { createdMessage: created, conversationForEmit: conversationRow };
            }
          );

          await emitMessageCreated(conversation.id, createdMessage.id, {
            message: createdMessage,
            conversation: conversationForEmit,
          });

          if (shouldHydrateMedia && parsed?.mediaId && accessToken) {
            scheduleIncomingMediaHydration({
              messageId: createdMessage.id,
              conversationId: conversation.id,
              accessToken,
              mediaId: parsed.mediaId,
              fileName: parsed.fileName,
              mimeType: parsed.mimeType,
            });
          }

          events.push({
            kind: "message",
            contactName,
            contactPhone: identity.phone || identity.identityKey,
            contentPreview: content.slice(0, 120),
            conversationId: conversation.id,
            messageId: createdMessage.id,
            inboxId: settings.inboxId,
            inboxName: settings.inbox.name,
          });

          processed += 1;
        } catch (error) {
          console.error(
            `[webhook] error procesando msg=${message.id} from=${message.from ?? message.from_user_id ?? "-"}:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }
  }

  return { processed, events };
}
