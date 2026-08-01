const ACCEPTED_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "txt"]);

export function isAcceptedAttachmentFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? ACCEPTED_EXTENSIONS.has(extension) : false;
}
