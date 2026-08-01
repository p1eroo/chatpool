import { env } from "@/config/env";
import { getAccessToken } from "@/api/client";

export async function downloadMessageAttachment(params: {
  attachmentUrl: string;
  fileName: string;
  inline?: boolean;
}): Promise<void> {
  const token = getAccessToken();
  const url = new URL(`${env.apiUrl}${params.attachmentUrl}`);
  if (params.inline) {
    url.searchParams.set("inline", "1");
  }

  const response = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = "No se pudo descargar el archivo";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message?.trim()) message = body.message.trim();
    } catch {
      // ignore invalid JSON
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = params.fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export async function fetchMessageAttachmentBlob(attachmentUrl: string): Promise<string> {
  const token = getAccessToken();
  const url = new URL(`${env.apiUrl}${attachmentUrl}`);
  url.searchParams.set("inline", "1");

  const response = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar el archivo");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
