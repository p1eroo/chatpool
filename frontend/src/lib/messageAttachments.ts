import { env } from "@/config/env";
import { getAccessToken } from "@/api/client";
import { withApiProgress } from "@/store/apiLoadingStore";

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Delay revoke so Chromium finishes the download handshake.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

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

  await withApiProgress(async () => {
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

    triggerBlobDownload(await response.blob(), params.fileName);
  });
}

/** Descarga forzada: API auth o blob (CDN cross-origin ignora el atributo download). */
export async function downloadFile(params: {
  fileName: string;
  attachmentUrl?: string | null;
  fileUrl?: string | null;
}): Promise<void> {
  if (params.attachmentUrl) {
    await downloadMessageAttachment({
      attachmentUrl: params.attachmentUrl,
      fileName: params.fileName,
    });
    return;
  }

  if (!params.fileUrl) {
    throw new Error("No hay archivo para descargar");
  }

  const response = await fetch(params.fileUrl);
  if (!response.ok) {
    throw new Error("No se pudo descargar el archivo");
  }

  triggerBlobDownload(await response.blob(), params.fileName);
}

export async function fetchMessageAttachmentBlob(attachmentUrl: string): Promise<string> {
  const token = getAccessToken();
  const url = new URL(`${env.apiUrl}${attachmentUrl}`);
  url.searchParams.set("inline", "1");

  return withApiProgress(async () => {
    const response = await fetch(url.toString(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar el archivo");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  });
}
