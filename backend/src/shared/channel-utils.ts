export type ChannelType =
  | "website"
  | "email"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "telegram"
  | "sms"
  | "api";

export type IntegrationProvider = "meta" | "email" | "website";

export function getProviderForChannel(channel: ChannelType): IntegrationProvider {
  if (channel === "whatsapp" || channel === "facebook" || channel === "instagram") {
    return "meta";
  }
  if (channel === "email") return "email";
  return "website";
}
