import { apiRequest, apiUpload, getAccessToken } from "@/api/client";
import { env } from "@/config/env";
import { withApiProgress } from "@/store/apiLoadingStore";
import type { CannedResponse } from "@/types";

export type UpsertCannedResponseInput = {
  inboxId: string;
  title: string;
  content: string;
  imageFile?: File | null;
};

export type UpdateCannedResponseInput = {
  title: string;
  content: string;
  imageFile?: File | null;
  removeImage?: boolean;
};

function buildCannedFormData(fields: {
  inboxId?: string;
  title: string;
  content: string;
  imageFile?: File | null;
  removeImage?: boolean;
}): FormData {
  const formData = new FormData();
  if (fields.inboxId) formData.append("inboxId", fields.inboxId);
  formData.append("title", fields.title);
  formData.append("content", fields.content);
  if (fields.removeImage) formData.append("removeImage", "true");
  if (fields.imageFile) formData.append("file", fields.imageFile);
  return formData;
}

export const cannedResponseApiService = {
  async list(inboxId: string): Promise<CannedResponse[]> {
    const params = new URLSearchParams({ inboxId });
    return apiRequest<CannedResponse[]>(`/canned-responses?${params}`);
  },

  async create(input: UpsertCannedResponseInput): Promise<CannedResponse> {
    const formData = buildCannedFormData({
      inboxId: input.inboxId,
      title: input.title,
      content: input.content,
      imageFile: input.imageFile,
    });
    return apiUpload<CannedResponse>("/canned-responses", formData);
  },

  async update(id: string, input: UpdateCannedResponseInput): Promise<CannedResponse> {
    const formData = buildCannedFormData({
      title: input.title,
      content: input.content,
      imageFile: input.imageFile,
      removeImage: input.removeImage,
    });
    return apiUpload<CannedResponse>(`/canned-responses/${id}`, formData, {
      method: "PATCH",
    });
  },

  async remove(id: string): Promise<void> {
    await apiRequest(`/canned-responses/${id}`, { method: "DELETE" });
  },

  async fetchImageFile(response: CannedResponse): Promise<File | null> {
    if (!response.attachmentUrl && !response.fileUrl) return null;

    let blob: Blob;
    if (response.attachmentUrl) {
      const token = getAccessToken();
      const url = new URL(`${env.apiUrl}${response.attachmentUrl}`);
      url.searchParams.set("inline", "1");
      blob = await withApiProgress(async () => {
        const res = await fetch(url.toString(), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          throw new Error("No se pudo cargar la imagen de la respuesta");
        }
        return res.blob();
      });
    } else {
      const res = await fetch(response.fileUrl!);
      if (!res.ok) {
        throw new Error("No se pudo cargar la imagen de la respuesta");
      }
      blob = await res.blob();
    }

    const mimeType =
      response.mimeType ||
      (blob.type.startsWith("image/") ? blob.type : "image/jpeg");
    const fileName = response.fileName || "imagen.jpg";
    return new File([blob], fileName, { type: mimeType });
  },
};
