const ACCEPTED_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "txt"]);

export function isAcceptedAttachmentFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? ACCEPTED_EXTENSIONS.has(extension) : false;
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
