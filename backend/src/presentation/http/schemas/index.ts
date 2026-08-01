import { z } from "zod";

export const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const verifyMetaBodySchema = z.object({
  inboxId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  businessAccountId: z.string().min(1),
  accessToken: z.string().optional(),
  syncWhatsAppContacts: z.boolean().optional(),
});

export const registerWebhookBodySchema = z.object({
  inboxId: z.string().min(1),
  provider: z.enum(["meta", "email", "website"]),
});

export const metaChallengeQuerySchema = z.object({
  "hub.mode": z.string().optional(),
  "hub.verify_token": z.string().optional(),
  "hub.challenge": z.string().optional(),
});
