-- Deduplicate concurrent open conversations (same inbox + contact), then enforce one open max.

DO $$
DECLARE
  grp RECORD;
  keeper_id TEXT;
  dup_id TEXT;
BEGIN
  FOR grp IN
    SELECT inbox_id, contact_id
    FROM conversations
    WHERE status = 'open'
    GROUP BY inbox_id, contact_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keeper_id
    FROM conversations
    WHERE inbox_id = grp.inbox_id
      AND contact_id = grp.contact_id
      AND status = 'open'
    ORDER BY last_message_at DESC NULLS LAST, updated_at DESC, created_at ASC
    LIMIT 1;

    FOR dup_id IN
      SELECT id
      FROM conversations
      WHERE inbox_id = grp.inbox_id
        AND contact_id = grp.contact_id
        AND status = 'open'
        AND id <> keeper_id
    LOOP
      UPDATE messages
      SET conversation_id = keeper_id
      WHERE conversation_id = dup_id;

      INSERT INTO conversation_labels (conversation_id, label_id)
      SELECT keeper_id, label_id
      FROM conversation_labels
      WHERE conversation_id = dup_id
      ON CONFLICT DO NOTHING;

      DELETE FROM conversation_labels WHERE conversation_id = dup_id;

      UPDATE conversations AS keeper
      SET
        unread_count = keeper.unread_count + dup.unread_count,
        last_message_at = CASE
          WHEN keeper.last_message_at IS NULL THEN dup.last_message_at
          WHEN dup.last_message_at IS NULL THEN keeper.last_message_at
          WHEN dup.last_message_at > keeper.last_message_at THEN dup.last_message_at
          ELSE keeper.last_message_at
        END,
        updated_at = NOW()
      FROM conversations AS dup
      WHERE keeper.id = keeper_id
        AND dup.id = dup_id;

      DELETE FROM conversations WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX "conversations_one_open_per_contact_idx"
ON "conversations" ("inbox_id", "contact_id")
WHERE "status" = 'open';
