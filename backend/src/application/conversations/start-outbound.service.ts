import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { mapContact, mapConversation } from "../mappers.js";
import { assertAgentCanAccessInbox } from "../inboxes/inbox-access.service.js";
import {
  enqueueAsociadoNameEnrichment,
  isAsociadosDirectoryReady,
  lookupAsociadoDisplayName,
} from "../contacts/asociados-directory.service.js";
import { upsertWhatsAppContact } from "../contacts/whatsapp-contact-sync.service.js";
import {
  isPlaceholderContactName,
  isWhatsAppPhoneSenderId,
  normalizeWhatsAppWaId,
} from "../../shared/whatsapp-contact.js";
import { findOrReopenConversationForContact } from "./conversations.service.js";
import { conversationRealtimeInclude } from "../realtime/realtime.service.js";

/** Normaliza a E.164 solo dígitos. Acepta 9 dígitos PE (9xxxxxxxx → 51…). */
export function normalizeOutboundWhatsAppPhone(raw: string): string {
  let digits = normalizeWhatsAppWaId(raw);
  if (!digits) {
    throw new AppError("El número de teléfono es obligatorio", 422, "INVALID_PHONE");
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    digits = `51${digits}`;
  }

  if (!isWhatsAppPhoneSenderId(digits)) {
    throw new AppError(
      "Número de WhatsApp inválido. Usa el formato internacional (ej. 51987654321).",
      422,
      "INVALID_PHONE"
    );
  }

  return digits;
}

export async function startOutboundConversation(params: {
  agentId: string;
  inboxId: string;
  phone: string;
  name?: string;
}) {
  await assertAgentCanAccessInbox(params.agentId, params.inboxId);

  const inbox = await prisma.inbox.findUnique({
    where: { id: params.inboxId },
    select: { id: true, channelType: true },
  });
  if (!inbox) throw new NotFoundError("Bandeja no encontrada");

  if (inbox.channelType !== "whatsapp") {
    throw new AppError(
      "Solo se pueden iniciar conversaciones nuevas desde bandejas de WhatsApp",
      422,
      "NOT_WHATSAPP"
    );
  }

  const phone = normalizeOutboundWhatsAppPhone(params.phone);
  const providedName = params.name?.trim() || "";
  const asociadoName = lookupAsociadoDisplayName(phone);
  const formattedPhone = `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  const displayName =
    asociadoName ||
    (providedName && !isPlaceholderContactName(providedName, phone)
      ? providedName
      : formattedPhone);

  const contactRow = await upsertWhatsAppContact(params.inboxId, {
    waId: phone,
    phone,
    name: displayName,
    touchLastSeen: true,
    overwriteName: false,
  });

  if (!contactRow) {
    throw new AppError("No se pudo crear el contacto", 500, "CONTACT_CREATE_FAILED");
  }

  if (contactRow.isBlocked) {
    throw new AppError(
      "Este contacto está bloqueado. Desbloquéalo para enviar mensajes.",
      422,
      "CONTACT_BLOCKED"
    );
  }

  const { conversation: started, reopened } = await findOrReopenConversationForContact({
    inboxId: params.inboxId,
    contactId: contactRow.id,
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: started.id },
    include: conversationRealtimeInclude,
  });

  if (!conversation) {
    throw new NotFoundError("Conversación no encontrada");
  }

  if (
    !asociadoName &&
    !isAsociadosDirectoryReady() &&
    isPlaceholderContactName(contactRow.name, phone)
  ) {
    enqueueAsociadoNameEnrichment({
      inboxId: params.inboxId,
      contactId: contactRow.id,
      phone,
      conversationId: conversation.id,
    });
  }

  return {
    contact: mapContact(contactRow),
    conversation: mapConversation(conversation),
    reopened,
    createdContact: true,
  };
}
