-- Webhooks salientes: solo URL (sin secret / firma HMAC).
ALTER TABLE "outgoing_webhooks" DROP COLUMN IF EXISTS "secret";
