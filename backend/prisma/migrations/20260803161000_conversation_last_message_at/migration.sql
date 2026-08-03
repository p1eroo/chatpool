-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "last_message_at" TIMESTAMP(3);

-- Backfill from latest non-system message
UPDATE "conversations" AS c
SET "last_message_at" = sub."created_at"
FROM (
  SELECT DISTINCT ON (m."conversation_id")
    m."conversation_id",
    m."created_at"
  FROM "messages" AS m
  WHERE m."sender_type"::text <> 'system'
  ORDER BY m."conversation_id", m."created_at" DESC
) AS sub
WHERE c."id" = sub."conversation_id";
