import { env } from "../../config/env.js";

interface MetaPhoneNumberResponse {
  display_phone_number?: string;
  verified_name?: string;
  id?: string;
}

interface MetaErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

interface MetaMediaMetadataResponse {
  url?: string;
  mime_type?: string;
  file_size?: number;
  id?: string;
}

interface MetaSendMessageResponse {
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
}

interface MetaUploadMediaResponse {
  id?: string;
}

export type WhatsAppTemplateComponentParameter = {
  type: "text";
  text: string;
};

export type WhatsAppTemplateSendComponent =
  | {
      type: "header" | "body";
      parameters: WhatsAppTemplateComponentParameter[];
    }
  | {
      type: "button";
      sub_type: "url";
      index: string;
      parameters: WhatsAppTemplateComponentParameter[];
    };

export type WhatsAppOutboundPayload = {
  /** Teléfono E.164 (dígitos). Preferido cuando existe. */
  to?: string;
  /** BSUID / parent BSUID cuando no hay teléfono (usernames Meta). */
  recipient?: string;
  context?: { message_id: string };
  type: "text" | "image" | "document" | "audio" | "video" | "template";
  text?: { body: string; preview_url?: boolean };
  image?: { id: string; caption?: string };
  document?: { id: string; filename?: string; caption?: string };
  audio?: { id: string };
  video?: { id: string; caption?: string };
  template?: {
    name: string;
    language: { code: string };
    components?: WhatsAppTemplateSendComponent[];
  };
};

export type MetaMessageTemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  example?: {
    body_text?: string[][];
    header_text?: string[];
  };
  buttons?: Array<{
    type?: string;
    text?: string;
    url?: string;
    example?: string[];
  }>;
};

export type MetaMessageTemplate = {
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: MetaMessageTemplateComponent[];
};

export class MetaApiClient {
  private readonly baseUrl = `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;

  async getPhoneNumber(
    phoneNumberId: string,
    accessToken: string
  ): Promise<{ phoneNumber?: string; verifiedName?: string }> {
    const url = new URL(`${this.baseUrl}/${phoneNumberId}`);
    url.searchParams.set("fields", "display_phone_number,verified_name");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url);
    const body = (await response.json()) as MetaPhoneNumberResponse & MetaErrorResponse;

    if (!response.ok) {
      throw new Error(body.error?.message ?? "No se pudo validar el número con Meta API");
    }

    return {
      phoneNumber: body.display_phone_number,
      verifiedName: body.verified_name,
    };
  }

  async requestSmbAppStateSync(
    phoneNumberId: string,
    accessToken: string
  ): Promise<{ requestId?: string }> {
    const url = `${this.baseUrl}/${phoneNumberId}/smb_app_data`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        sync_type: "smb_app_state_sync",
      }),
    });

    const body = (await response.json()) as { request_id?: string } & MetaErrorResponse;

    if (!response.ok) {
      throw new Error(body.error?.message ?? "No se pudo solicitar sync de contactos");
    }

    return { requestId: body.request_id };
  }

  async subscribeAppToWaba(businessAccountId: string, accessToken: string): Promise<boolean> {
    const url = `${this.baseUrl}/${businessAccountId}/subscribed_apps`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    });

    const body = (await response.json()) as { success?: boolean; error?: MetaErrorResponse["error"] };

    if (!response.ok) {
      throw new Error(body.error?.message ?? "No se pudo suscribir la app al WABA");
    }

    return body.success === true;
  }

  async getMediaMetadata(
    mediaId: string,
    accessToken: string
  ): Promise<{ url: string; mimeType: string; fileSize?: number }> {
    const url = new URL(`${this.baseUrl}/${mediaId}`);
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url);
    const body = (await response.json()) as MetaMediaMetadataResponse & MetaErrorResponse;

    if (!response.ok || !body.url) {
      throw new Error(body.error?.message ?? "No se pudo obtener metadata del media de Meta");
    }

    return {
      url: body.url,
      mimeType: body.mime_type ?? "application/octet-stream",
      fileSize: body.file_size,
    };
  }

  async downloadMedia(url: string, accessToken: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`No se pudo descargar media de Meta (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error("Media de Meta vacío");
    }

    return buffer;
  }

  async sendWhatsAppMessage(
    phoneNumberId: string,
    accessToken: string,
    payload: WhatsAppOutboundPayload
  ): Promise<string> {
    if (!payload.to && !payload.recipient) {
      throw new Error("Falta destinatario WhatsApp (to o recipient)");
    }

    const url = `${this.baseUrl}/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        ...payload,
      }),
    });

    const body = (await response.json()) as MetaSendMessageResponse & MetaErrorResponse;

    if (!response.ok) {
      const code = body.error?.code;
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      throw new Error(code ? `(${code}) ${detail}` : detail);
    }

    const messageId = body.messages?.[0]?.id;
    if (!messageId) {
      throw new Error("Meta no devolvió el ID del mensaje enviado");
    }

    return messageId;
  }

  async listMessageTemplates(
    businessAccountId: string,
    accessToken: string
  ): Promise<MetaMessageTemplate[]> {
    const templates: MetaMessageTemplate[] = [];
    let nextUrl: string | null = `${this.baseUrl}/${businessAccountId}/message_templates?fields=name,language,status,category,components&limit=100`;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const body = (await response.json()) as {
        data?: MetaMessageTemplate[];
        paging?: { next?: string };
        error?: MetaErrorResponse["error"];
      };

      if (!response.ok) {
        const code = body.error?.code;
        const detail = body.error?.message ?? `HTTP ${response.status}`;
        throw new Error(code ? `(${code}) ${detail}` : detail);
      }

      for (const item of body.data ?? []) {
        if (item?.name && item?.language) {
          templates.push(item);
        }
      }

      nextUrl = body.paging?.next ?? null;
    }

    return templates;
  }

  async uploadWhatsAppMedia(
    phoneNumberId: string,
    accessToken: string,
    params: { buffer: Buffer; mimeType: string; filename: string }
  ): Promise<string> {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", params.mimeType);
    form.append(
      "file",
      new Blob([params.buffer], { type: params.mimeType }),
      params.filename
    );

    const url = `${this.baseUrl}/${phoneNumberId}/media`;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });

    const body = (await response.json()) as MetaUploadMediaResponse & MetaErrorResponse;

    if (!response.ok) {
      const code = body.error?.code;
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      throw new Error(code ? `(${code}) ${detail}` : detail);
    }

    if (!body.id) {
      throw new Error("Meta no devolvió el ID del archivo subido");
    }

    return body.id;
  }
}

export const metaApiClient = new MetaApiClient();
