-- Bandejitas: sub-colas virtuales dentro de una bandeja.
CREATE TABLE "mini_inboxes" (
    "id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "match_phrases" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mini_inboxes_pkey" PRIMARY KEY ("id")
);

-- Una conversación puede estar en como máximo UNA bandejita.
ALTER TABLE "conversations" ADD COLUMN "mini_inbox_id" TEXT;

ALTER TABLE "mini_inboxes" ADD CONSTRAINT "mini_inboxes_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_mini_inbox_id_fkey" FOREIGN KEY ("mini_inbox_id") REFERENCES "mini_inboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Si se elimina una bandejita, sus conversaciones vuelven a la bandeja principal (null).
CREATE UNIQUE INDEX "mini_inboxes_inbox_id_name_key" ON "mini_inboxes"("inbox_id", "name");

CREATE INDEX "mini_inboxes_inbox_id_idx" ON "mini_inboxes"("inbox_id");

CREATE INDEX "conversations_mini_inbox_id_idx" ON "conversations"("mini_inbox_id");
