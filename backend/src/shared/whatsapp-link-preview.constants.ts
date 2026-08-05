/**
 * Convenciones de Meta para link previews en WhatsApp.
 * @see https://developers.facebook.com/docs/whatsapp/link-previews/
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages/#link-preview
 */

/** User-Agent que WhatsApp usa al crawlear sitios (web = sufijo `N`). */
export const WHATSAPP_LINK_PREVIEW_USER_AGENT = "WhatsApp/2.2412.5 N";

/** Tiempo máximo de crawl similar al cliente WhatsApp (~10s en docs). */
export const WHATSAPP_LINK_PREVIEW_TIMEOUT_SEC = 10;
