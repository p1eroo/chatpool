-- AlterTable
ALTER TABLE "messages" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Preserve chronological order within each conversation
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY conversation_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM "messages"
)
UPDATE "messages" AS m
SET "sort_order" = ranked.rn
FROM ranked
WHERE m.id = ranked.id;

CREATE INDEX "messages_conversation_id_sort_order_idx" ON "messages"("conversation_id", "sort_order");
