import type { WhatsAppTemplateSendComponent } from "../../infrastructure/meta/meta-api.client.js";
import { AppError } from "../../domain/errors.js";
import type { WhatsAppTemplateDto } from "./whatsapp-templates.service.js";

export type TemplateParameterFormat = "named" | "positional";

/** Extrae placeholders en orden de aparición: {{1}} o {{reservation_id}}. */
export function extractPlaceholderNames(text: string | null | undefined): string[] {
  if (!text) return [];
  const names: string[] = [];
  for (const match of text.matchAll(/\{\{([^}]+)\}\}/g)) {
    names.push(match[1].trim());
  }
  return names;
}

export function inferParameterFormat(
  parameterFormatRaw: string | undefined,
  bodyText: string,
  headerText: string | null
): TemplateParameterFormat {
  const fmt = (parameterFormatRaw ?? "").toUpperCase();
  if (fmt === "NAMED") return "named";
  if (fmt === "POSITIONAL") return "positional";

  const placeholders = [...extractPlaceholderNames(bodyText), ...extractPlaceholderNames(headerText)];
  if (placeholders.some((name) => !/^\d+$/.test(name))) {
    return "named";
  }
  return "positional";
}

export function buildTextTemplateParameters(
  values: string[],
  paramNames: string[],
  format: TemplateParameterFormat
) {
  if (format === "named") {
    return values.map((text, index) => ({
      type: "text" as const,
      parameter_name: paramNames[index] ?? String(index + 1),
      text,
    }));
  }
  return values.map((text) => ({ type: "text" as const, text }));
}

export function resolveTemplateParamsFromRecord(
  record: Record<string, string> | undefined,
  paramNames: string[],
  paramCount: number
): string[] | undefined {
  if (!record) return undefined;
  if (paramCount === 0) return [];

  const keys = Object.keys(record);
  if (keys.length === 0) return [];

  const allNumeric = keys.every((key) => /^\d+$/.test(key));
  if (allNumeric) {
    return keys
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => record[key] ?? "");
  }

  if (!paramNames.length) {
    throw new AppError(
      "Las claves del body deben ser numéricas (\"0\", \"1\", …)",
      422,
      "TEMPLATE_PARAMS_INVALID"
    );
  }

  const missing = paramNames.filter((name) => !record[name]?.trim());
  if (missing.length) {
    const numericHint =
      paramCount > 0
        ? ` o claves numéricas "0"…"${paramCount - 1}" en orden`
        : "";
    throw new AppError(
      `Faltan variables: ${missing.join(", ")}. Use ${paramNames.map((n) => `"${n}"`).join(", ")}${numericHint}.`,
      422,
      "TEMPLATE_PARAMS_INVALID"
    );
  }

  return paramNames.map((name) => record[name]!.trim());
}

export function buildTemplateSendComponents(params: {
  template: WhatsAppTemplateDto;
  bodyParameters: string[];
  headerParameters: string[];
  headerMediaUrl?: string;
  buttonUrlParameters: Array<{ index: number; text: string }>;
}): WhatsAppTemplateSendComponent[] {
  const { template, bodyParameters, headerParameters, headerMediaUrl, buttonUrlParameters } =
    params;

  const components: WhatsAppTemplateSendComponent[] = [];

  if (template.headerFormat === "IMAGE" && headerMediaUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: headerMediaUrl } }],
    });
  } else if (headerParameters.length) {
    components.push({
      type: "header",
      parameters: buildTextTemplateParameters(
        headerParameters,
        template.headerParamNames,
        template.parameterFormat
      ),
    });
  }

  if (bodyParameters.length) {
    components.push({
      type: "body",
      parameters: buildTextTemplateParameters(
        bodyParameters,
        template.bodyParamNames,
        template.parameterFormat
      ),
    });
  }

  for (const button of buttonUrlParameters) {
    components.push({
      type: "button",
      sub_type: "url",
      index: String(button.index),
      parameters: [{ type: "text", text: button.text }],
    });
  }

  return components;
}
