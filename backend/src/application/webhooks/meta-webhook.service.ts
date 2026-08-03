import { prisma } from "../../infrastructure/database/prisma.client.js";
import { emitMessageCreated, emitMessageUpdated } from "../realtime/realtime.service.js";
import { resolveMetaApiFailure } from "../../shared/meta-api-errors.js";
import {
  downloadAndStoreMetaMedia,
  parseIncomingMetaMedia,
} from "../media/meta-media.service.js";
import { messageInclude } from "../mappers.js";
import {
  processSmbAppStateSync,
  upsertWhatsAppContact,
} from "../contacts/whatsapp-contact-sync.service.js";
import { findOrReopenConversationForContact } from "../conversations/conversations.service.js";
import { touchConversationLastMessageAt } from "../conversations/conversation-last-message.js";
import { runWithConversationMessageLock } from "../conversations/conversation-message-serializer.js";
import { nextMessageSortOrder } from "../conversations/message-sort-order.js";
import { parseMetaMessageTimestamp } from "../../shared/meta-message-time.js";

interface MetaMediaPayload {
  id?: string;
  mime_type?: string;
  filename?: string;
  caption?: string;
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
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id?: string;
          from?: string;
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

async function getDefaultAssigneeId(inboxId: string): Promise<string | null> {
  const assignments = await prisma.inboxAgent.findMany({
    where: { inboxId },
    orderBy: { agentId: "asc" },
    select: { agentId: true },
  });

  if (assignments.length === 1) {
    return assignments[0].agentId;
  }

  return null;
}

type MetaStatusEvent = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
};

function mapMetaDeliveryStatus(status?: string): "sent" | "delivered" | "read" | "failed" | null {
  if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
    return status;
  }
  return null;
}

async function processMetaMessageStatuses(statuses: MetaStatusEvent[] | undefined): Promise<number> {
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

    await prisma.message.update({
      where: { id: message.id },
      data: { status: nextStatus },
    });

    await emitMessageUpdated(message.conversationId, message.id);
    processed += 1;
  }

  return processed;
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

      const defaultAssigneeId = await getDefaultAssigneeId(settings.inboxId);
      const accessToken = settings.accessToken?.trim() || null;

      processed += await processMetaMessageStatuses(value.statuses);

      for (const message of value.messages ?? []) {
        if (!message.from || !message.id) continue;

        const contactName =
          value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name ??
          message.from;

        const contact = await upsertWhatsAppContact(settings.inboxId, {
          waId: message.from,
          name: contactName,
          touchLastSeen: true,
        });

        if (!contact) continue;

        const { conversation } = await findOrReopenConversationForContact({
          inboxId: settings.inboxId,
          contactId: contact.id,
          defaultAssigneeId,
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
        let fileSize: number | null = null;
        let fileKey: string | null = null;
        let mimeType: string | null = null;
        let mediaExternalId: string | null = parsed?.mediaId || null;

        if (parsed?.mediaId && accessToken) {
          try {
            const stored = await downloadAndStoreMetaMedia({
              conversationId: conversation.id,
              accessToken,
              mediaId: parsed.mediaId,
              fileName: parsed.fileName,
              mimeType: parsed.mimeType,
            });
            fileName = stored.fileName;
            fileSize = stored.fileSize;
            fileKey = stored.fileKey;
            mimeType = stored.mimeType;
            contentType = parsed.contentType;
            if (!content || content === parsed.fileName) {
              content = parsed.contentType === "audio" ? stored.fileName : stored.fileName;
            }
          } catch (error) {
            const failure = resolveMetaApiFailure(error);
            console.error("No se pudo descargar media de Meta:", failure.message);
            content = parsed.fileName || fallbackContent;
            contentType = parsed.contentType;
            fileName = parsed.fileName;
            mimeType = parsed.mimeType;
          }
        } else if (parsed && parsed.contentType !== "text") {
          content = parsed.fileName || fallbackContent;
          contentType = parsed.contentType;
          fileName = parsed.fileName;
          mimeType = parsed.mimeType;
        }

        const messageAt = parseMetaMessageTimestamp(message.timestamp);

        const createdMessage = await runWithConversationMessageLock(
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
                fileSize,
                fileKey,
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

            await prisma.conversation.update({
              where: { id: conversation.id },
              data: {
                unreadCount: { increment: 1 },
              },
            });

            await touchConversationLastMessageAt(conversation.id, messageAt);

            return created;
          }
        );

        await emitMessageCreated(conversation.id, createdMessage.id);

        events.push({
          kind: "message",
          contactName,
          contactPhone: message.from,
          contentPreview: content.slice(0, 120),
          conversationId: conversation.id,
          messageId: createdMessage.id,
          inboxId: settings.inboxId,
          inboxName: settings.inbox.name,
        });

        processed += 1;
      }
    }
  }

  return { processed, events };
}
