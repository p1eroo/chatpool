import type { WhatsAppTemplate } from "@/types/whatsappTemplate";

/** Solo para modo mock local (sin Meta). */
export const MOCK_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "hello_world__en_US",
    name: "hello_world",
    language: "en_US",
    category: "UTILITY",
    preview:
      "Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta.",
    bodyText:
      "Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta.",
    headerText: null,
    headerFormat: "NONE",
    bodyParamCount: 0,
    headerParamCount: 0,
    buttonUrlParamIndexes: [],
    supported: true,
  },
  {
    id: "order_update__es",
    name: "order_update",
    language: "es",
    category: "UTILITY",
    preview: "Hola {{1}}, tu pedido #{{2}} ha sido actualizado. Estado actual: {{3}}.",
    bodyText: "Hola {{1}}, tu pedido #{{2}} ha sido actualizado. Estado actual: {{3}}.",
    headerText: null,
    headerFormat: "NONE",
    bodyParamCount: 3,
    headerParamCount: 0,
    buttonUrlParamIndexes: [],
    supported: true,
  },
];
