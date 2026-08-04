export interface WhatsAppTemplate {
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
  buttonUrlParamIndexes: number[];
  supported: boolean;
  unsupportedReason?: string;
}

export interface SendWhatsAppTemplatePayload {
  templateId: string;
  templateName: string;
  language: string;
  content: string;
  bodyParameters?: string[];
  headerParameters?: string[];
  buttonUrlParameters?: Array<{ index: number; text: string }>;
}

export function fillTemplatePlaceholders(text: string, params: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, raw: string) => {
    const index = Number(raw) - 1;
    return params[index]?.trim() ? params[index] : `{{${raw}}}`;
  });
}

export function buildTemplatePreviewContent(
  template: WhatsAppTemplate,
  bodyParameters: string[],
  headerParameters: string[]
): string {
  const parts: string[] = [];
  if (template.headerText) {
    parts.push(fillTemplatePlaceholders(template.headerText, headerParameters));
  }
  if (template.bodyText) {
    parts.push(fillTemplatePlaceholders(template.bodyText, bodyParameters));
  }
  return parts.join("\n") || template.preview || template.name;
}

export function templateNeedsParams(template: WhatsAppTemplate): boolean {
  return (
    template.bodyParamCount > 0 ||
    template.headerParamCount > 0 ||
    template.buttonUrlParamIndexes.length > 0
  );
}
