const ACCEPTED_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "txt"]);

/** WhatsApp móvil permite ~30; Cloud API = 1 media/mensaje → N mensajes. 10 es un límite razonable en web. */
export const MAX_PENDING_IMAGES = 10;

/** Alineado con FILES_MAX_MB del backend (50 por defecto). */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export function isImageAttachmentFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function isAcceptedAttachmentFile(file: File): boolean {
  if (isImageAttachmentFile(file)) return true;

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? ACCEPTED_EXTENSIONS.has(extension) : false;
}

export function isWithinAttachmentSizeLimit(file: File): boolean {
  return file.size <= MAX_ATTACHMENT_BYTES;
}

export type StageAttachmentsResult =
  | { ok: true; files: File[]; truncated: boolean }
  | { ok: false; reason: string };

/**
 * Combina adjuntos pendientes con archivos nuevos.
 * - Varias imágenes (como WhatsApp).
 * - Un solo documento (no mezclar con imágenes).
 */
export function mergePendingAttachments(
  current: File[],
  incoming: File[]
): StageAttachmentsResult {
  const accepted = incoming.filter(isAcceptedAttachmentFile);
  if (accepted.length === 0) {
    return { ok: false, reason: "Tipo de archivo no soportado" };
  }

  const tooLarge = accepted.find((file) => !isWithinAttachmentSizeLimit(file));
  if (tooLarge) {
    return {
      ok: false,
      reason: `«${tooLarge.name}» supera el límite de ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB`,
    };
  }

  const incomingImages = accepted.filter(isImageAttachmentFile);
  const incomingDocs = accepted.filter((file) => !isImageAttachmentFile(file));

  const currentHasImages = current.some(isImageAttachmentFile);
  const currentHasDocs = current.some((file) => !isImageAttachmentFile(file));

  if (incomingDocs.length > 0 && (incomingImages.length > 0 || currentHasImages)) {
    return { ok: false, reason: "Envía varias imágenes o un documento, no ambos a la vez" };
  }

  if (currentHasDocs && incomingImages.length > 0) {
    return { ok: false, reason: "Quita el archivo antes de adjuntar imágenes" };
  }

  if (currentHasImages && incomingDocs.length > 0) {
    return { ok: false, reason: "Quita las imágenes antes de adjuntar un archivo" };
  }

  if (incomingDocs.length > 0 || currentHasDocs) {
    const doc = incomingDocs[0] ?? current[0];
    if (!doc) return { ok: false, reason: "No se pudo adjuntar el archivo" };
    return { ok: true, files: [doc], truncated: incomingDocs.length > 1 };
  }

  const merged = [...current, ...incomingImages];
  const truncated = merged.length > MAX_PENDING_IMAGES;
  const capped = merged.slice(0, MAX_PENDING_IMAGES);

  if (capped.length === current.length && incomingImages.length > 0) {
    return {
      ok: false,
      reason: `Máximo ${MAX_PENDING_IMAGES} imágenes por envío`,
    };
  }

  return { ok: true, files: capped, truncated };
}

/** Archivo pegado (Ctrl+V / captura). null si solo hay texto u otro tipo. */
export function getClipboardAttachmentFile(data: DataTransfer | null): File | null {
  if (!data) return null;

  const fromFiles = Array.from(data.files ?? []).find((file) => isAcceptedAttachmentFile(file));
  if (fromFiles) return normalizePastedFile(fromFiles);

  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isAcceptedAttachmentFile(file)) {
      return normalizePastedFile(file);
    }
  }

  return null;
}

function normalizePastedFile(file: File): File {
  const genericName =
    !file.name ||
    file.name === "image.png" ||
    file.name === "image.jpg" ||
    file.name === "blob" ||
    file.name === "null";

  if (!genericName) return file;

  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : file.type.startsWith("image/")
            ? "png"
            : file.name.split(".").pop() || "bin";

  return new File([file], `captura-${Date.now()}.${ext}`, {
    type: file.type || "application/octet-stream",
    lastModified: Date.now(),
  });
}
