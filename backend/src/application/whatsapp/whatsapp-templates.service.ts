import { prisma } from "../../infrastructure/database/prisma.client.js";
import { metaApiClient } from "../../infrastructure/meta/meta-api.client.js";
import type { MetaMessageTemplate } from "../../infrastructure/meta/meta-api.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import { resolveMetaSendFailure } from "../../shared/meta-api-errors.js";
import { assertAgentCanAccessInbox } from "../inboxes/inbox-access.service.js";

export type WhatsAppTemplateDto = {
  id: string;
  name: string;
  language: string;
  category: string;
  preview: string;
  bodyText: string;
  headerText: string | null;
  headerFormat: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  bodyParamCount: number;
  headerParamCount: number;
  /** true si el header es IMAGE/VIDEO/DOCUMENT y hay que mandar URL al enviar */
  headerMediaRequired: boolean;
  buttonUrlParamIndexes: number[];
  supported: boolean;
  unsupportedReason?: string;
};

function countPlaceholders(text: string | undefined | null): number {
  if (!text) return 0;
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches?.length) return 0;
  let max = 0;
  for (const match of matches) {
    const n = Number(match.replace(/\D/g, ""));
    if (n > max) max = n;
  }
  return max;
}

/** Cuenta {{1}} y {{nombre}} — orden de aparición en el texto. */
function countAllPlaceholders(text: string | undefined | null): number {
  if (!text) return 0;
  return text.match(/\{\{[^}]+\}\}/g)?.length ?? 0;
}

function fillPlaceholders(text: string, params: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, raw: string) => {
    const index = Number(raw) - 1;
    return params[index] ?? `{{${raw}}}`;
  });
}

function fillPlaceholdersSequential(text: string, params: string[]): string {
  let index = 0;
  return text.replace(/\{\{[^}]+\}\}/g, () => {
    const value = params[index++];
    return value?.trim() ? value : "";
  });
}

export function mapMetaTemplate(raw: MetaMessageTemplate): WhatsAppTemplateDto {
  const components = raw.components ?? [];
  const body = components.find((c) => (c.type ?? "").toUpperCase() === "BODY");
  const header = components.find((c) => (c.type ?? "").toUpperCase() === "HEADER");
  const buttons = components.find((c) => (c.type ?? "").toUpperCase() === "BUTTONS");

  const bodyText = body?.text?.trim() || "";
  const headerFormatRaw = (header?.format ?? "NONE").toUpperCase();
  const headerFormat = (
    ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"].includes(headerFormatRaw)
      ? headerFormatRaw
      : "NONE"
  ) as WhatsAppTemplateDto["headerFormat"];

  const headerText = headerFormat === "TEXT" ? header?.text?.trim() || null : null;
  const bodyParamCount = Math.max(countPlaceholders(bodyText), countAllPlaceholders(bodyText));
  const headerParamCount =
    headerFormat === "TEXT"
      ? Math.max(countPlaceholders(headerText), countAllPlaceholders(headerText))
      : 0;
  const headerMediaRequired =
    headerFormat === "IMAGE" || headerFormat === "VIDEO" || headerFormat === "DOCUMENT";

  const buttonUrlParamIndexes: number[] = [];
  (buttons?.buttons ?? []).forEach((button, index) => {
    if ((button.type ?? "").toUpperCase() !== "URL") return;
    if (countPlaceholders(button.url) > 0) {
      buttonUrlParamIndexes.push(index);
    }
  });

  let supported = true;
  let unsupportedReason: string | undefined;

  if (headerFormat === "VIDEO" || headerFormat === "DOCUMENT") {
    supported = false;
    unsupportedReason = `Encabezado ${headerFormat} aún no soportado. Usa IMAGE con URL pública.`;
  } else if (headerFormat === "LOCATION") {
    supported = false;
    unsupportedReason = "Esta plantilla requiere ubicación en el encabezado (aún no soportado).";
  }

  const previewParts = [headerText, bodyText].filter(Boolean);
  const preview = previewParts.join("\n") || raw.name;

  return {
    id: `${raw.name}__${raw.language}`,
    name: raw.name,
    language: raw.language,
    category: raw.category ?? "UNKNOWN",
    preview,
    bodyText,
    headerText,
    headerFormat,
    bodyParamCount,
    headerParamCount,
    headerMediaRequired,
    buttonUrlParamIndexes,
    supported,
    unsupportedReason,
  };
}

async function resolveInboxMetaCredentials(inboxId: string) {
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    include: { settings: true },
  });

  if (!inbox) throw new NotFoundError("Bandeja no encontrada");
  if (inbox.channelType !== "whatsapp") {
    throw new AppError("Solo las bandejas de WhatsApp tienen plantillas", 422, "NOT_WHATSAPP");
  }

  const phoneNumberId = inbox.settings?.phoneNumberId?.trim();
  const accessToken = inbox.settings?.accessToken?.trim();
  const businessAccountId = inbox.settings?.businessAccountId?.trim();

  if (!phoneNumberId || !accessToken) {
    throw new AppError(
      "La bandeja no tiene phone_number_id o token de Meta configurados",
      422,
      "META_NOT_CONFIGURED"
    );
  }

  if (!businessAccountId) {
    throw new AppError(
      "La bandeja no tiene WhatsApp Business Account ID configurado",
      422,
      "META_WABA_MISSING"
    );
  }

  return { phoneNumberId, accessToken, businessAccountId };
}

export async function listApprovedWhatsAppTemplatesForInbox(inboxId: string) {
  const { accessToken, businessAccountId } = await resolveInboxMetaCredentials(inboxId);

  try {
    const raw = await metaApiClient.listMessageTemplates(businessAccountId, accessToken);
    return raw
      .filter((item) => (item.status ?? "").toUpperCase() === "APPROVED")
      .map(mapMetaTemplate)
      .sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));
  } catch (error) {
    if (error instanceof AppError) throw error;
    const failure = resolveMetaSendFailure(error);
    throw new AppError(failure.message, 502, failure.code);
  }
}

export async function listWhatsAppTemplatesForInbox(inboxId: string, agentId: string) {
  await assertAgentCanAccessInbox(agentId, inboxId);
  return listApprovedWhatsAppTemplatesForInbox(inboxId);
}

export async function findApprovedTemplate(
  inboxId: string,
  name: string,
  language: string
): Promise<WhatsAppTemplateDto> {
  const { accessToken, businessAccountId } = await resolveInboxMetaCredentials(inboxId);

  let raw: MetaMessageTemplate[];
  try {
    raw = await metaApiClient.listMessageTemplates(businessAccountId, accessToken);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const failure = resolveMetaSendFailure(error);
    throw new AppError(failure.message, 502, failure.code);
  }

  const match = raw.find(
    (item) =>
      item.name === name &&
      item.language === language &&
      (item.status ?? "").toUpperCase() === "APPROVED"
  );

  if (!match) {
    throw new AppError(
      `Plantilla "${name}" (${language}) no encontrada o no aprobada en Meta`,
      404,
      "TEMPLATE_NOT_FOUND"
    );
  }

  const mapped = mapMetaTemplate(match);
  if (!mapped.supported) {
    throw new AppError(
      mapped.unsupportedReason ?? "Plantilla no soportada",
      422,
      "TEMPLATE_UNSUPPORTED"
    );
  }

  return mapped;
}

export function buildTemplatePreview(
  template: WhatsAppTemplateDto,
  params: {
    bodyParameters?: string[];
    headerParameters?: string[];
    headerMediaUrl?: string;
  }
): string {
  const parts: string[] = [];
  if (template.headerFormat === "IMAGE" && params.headerMediaUrl?.trim()) {
    parts.push(`[Imagen: ${params.headerMediaUrl.trim()}]`);
  }
  if (template.headerText) {
    const headerParams = params.headerParameters ?? [];
    parts.push(
      countAllPlaceholders(template.headerText) > countPlaceholders(template.headerText)
        ? fillPlaceholdersSequential(template.headerText, headerParams)
        : fillPlaceholders(template.headerText, headerParams)
    );
  }
  if (template.bodyText) {
    const bodyParams = params.bodyParameters ?? [];
    parts.push(
      countAllPlaceholders(template.bodyText) > countPlaceholders(template.bodyText)
        ? fillPlaceholdersSequential(template.bodyText, bodyParams)
        : fillPlaceholders(template.bodyText, bodyParams)
    );
  }
  return parts.join("\n") || template.name;
}

export function assertTemplateParameters(
  template: WhatsAppTemplateDto,
  params: {
    bodyParameters?: string[];
    headerParameters?: string[];
    headerMediaUrl?: string;
    buttonUrlParameters?: Array<{ index: number; text: string }>;
  }
) {
  const bodyParameters = params.bodyParameters ?? [];
  const headerParameters = params.headerParameters ?? [];
  const buttonUrlParameters = params.buttonUrlParameters ?? [];
  const headerMediaUrl = params.headerMediaUrl?.trim() ?? "";

  if (template.headerMediaRequired && !headerMediaUrl) {
    throw new AppError(
      "La plantilla requiere processed_params.header_media.url (HTTPS, imagen pública)",
      422,
      "TEMPLATE_PARAMS_INVALID"
    );
  }

  if (bodyParameters.length !== template.bodyParamCount) {
    throw new AppError(
      `La plantilla requiere ${template.bodyParamCount} variable(s) en el cuerpo`,
      422,
      "TEMPLATE_PARAMS_INVALID"
    );
  }

  if (headerParameters.length !== template.headerParamCount) {
    throw new AppError(
      `La plantilla requiere ${template.headerParamCount} variable(s) en el encabezado`,
      422,
      "TEMPLATE_PARAMS_INVALID"
    );
  }

  if (bodyParameters.some((value) => !value.trim()) || headerParameters.some((value) => !value.trim())) {
    throw new AppError("Todas las variables de la plantilla son obligatorias", 422, "TEMPLATE_PARAMS_INVALID");
  }

  const expectedButtons = new Set(template.buttonUrlParamIndexes);
  const providedButtons = new Set(buttonUrlParameters.map((item) => item.index));

  if (expectedButtons.size !== providedButtons.size || [...expectedButtons].some((i) => !providedButtons.has(i))) {
    throw new AppError(
      "Faltan variables de botones URL en la plantilla",
      422,
      "TEMPLATE_PARAMS_INVALID"
    );
  }

  if (buttonUrlParameters.some((item) => !item.text.trim())) {
    throw new AppError("Todas las variables de botones son obligatorias", 422, "TEMPLATE_PARAMS_INVALID");
  }
}
