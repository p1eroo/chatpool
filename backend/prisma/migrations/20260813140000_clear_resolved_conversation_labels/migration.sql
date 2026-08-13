-- Quita etiquetas y assignee de conversaciones ya resueltas,
-- alineado con la limpieza al resolver.

DELETE FROM conversation_labels cl
USING conversations c
WHERE cl.conversation_id = c.id
  AND c.status = 'resolved';

UPDATE conversations
SET assignee_id = NULL
WHERE status = 'resolved'
  AND assignee_id IS NOT NULL;
