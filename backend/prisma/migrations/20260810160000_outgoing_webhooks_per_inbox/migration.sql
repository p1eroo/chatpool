-- Webhooks salientes pasan a ser por bandeja (los globales previos dejan de aplicar).
DELETE FROM "outgoing_webhooks";

ALTER TABLE "outgoing_webhooks" ADD COLUMN "inbox_id" TEXT NOT NULL;

CREATE INDEX "outgoing_webhooks_inbox_id_idx" ON "outgoing_webhooks"("inbox_id");

ALTER TABLE "outgoing_webhooks"
  ADD CONSTRAINT "outgoing_webhooks_inbox_id_fkey"
  FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
