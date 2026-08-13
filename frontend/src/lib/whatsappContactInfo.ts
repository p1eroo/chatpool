/** Texto del mensaje interactivo REQUEST_CONTACT_INFO (el botón lo pone WhatsApp). */
export const REQUEST_CONTACT_INFO_BODY =
  "Para continuar, por favor comparta su número de teléfono. WhatsApp no lo envía automáticamente cuando se utiliza un nombre de usuario.";

export const MISSING_WHATSAPP_PHONE_NOTE =
  "Este contacto no tiene número. Pídeselo con el botón oficial de WhatsApp; el cliente no tiene que escribirlo.";

export function contactHasPhone(phone?: string | null): boolean {
  return Boolean(phone?.replace(/\D/g, ""));
}

export function isMissingWhatsAppPhoneNote(message: {
  isPrivate?: boolean;
  content?: string;
}): boolean {
  return Boolean(message.isPrivate && message.content === MISSING_WHATSAPP_PHONE_NOTE);
}

export function isSharedContactMessageContent(content?: string | null): boolean {
  const trimmed = content?.trim() ?? "";
  if (!trimmed) return false;
  return (
    trimmed === "[contacts]" ||
    trimmed.startsWith("Compartió su número:") ||
    trimmed.startsWith("Compartió un contacto")
  );
}

export function parseSharedContactDisplay(content: string): {
  title: string;
  subtitle?: string;
} {
  const trimmed = content.trim();
  if (trimmed === "[contacts]" || trimmed === "Compartió un contacto") {
    return { title: "Contacto compartido" };
  }

  const ownNumber = trimmed.match(/^Compartió su número:\s*(.+)$/);
  if (ownNumber) {
    return { title: "Número compartido", subtitle: ownNumber[1].trim() };
  }

  const other = trimmed.match(/^Compartió un contacto:\s*(.+)$/);
  if (other) {
    return { title: "Contacto compartido", subtitle: other[1].trim() };
  }

  return { title: "Contacto compartido" };
}

export function displayInboundMessageContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed === "[contacts]") return "Compartió un contacto";
  return content;
}
