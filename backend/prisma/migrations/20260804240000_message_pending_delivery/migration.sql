-- Estado pending: mensaje persistido, entrega a Meta en curso.
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'pending';

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "client_message_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversation_client_message_id_key"
  ON "messages" ("conversation_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;
