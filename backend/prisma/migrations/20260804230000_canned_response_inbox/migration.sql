-- AlterTable: respuestas predefinidas por bandeja
ALTER TABLE "canned_responses" ADD COLUMN "inbox_id" TEXT;

-- Asigna las existentes a la bandeja más antigua (si hay alguna)
UPDATE "canned_responses" AS cr
SET "inbox_id" = (
  SELECT i."id" FROM "inboxes" i ORDER BY i."created_at" ASC LIMIT 1
)
WHERE cr."inbox_id" IS NULL;

-- Si no había bandejas, elimina huérfanas
DELETE FROM "canned_responses" WHERE "inbox_id" IS NULL;

ALTER TABLE "canned_responses" ALTER COLUMN "inbox_id" SET NOT NULL;

CREATE INDEX "canned_responses_inbox_id_idx" ON "canned_responses"("inbox_id");

ALTER TABLE "canned_responses"
ADD CONSTRAINT "canned_responses_inbox_id_fkey"
FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
