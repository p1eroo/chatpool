-- AlterEnum
ALTER TYPE "MessageContentType" ADD VALUE 'sticker';

-- CreateTable
CREATE TABLE "saved_stickers" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "source_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_stickers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_stickers_agent_id_created_at_idx" ON "saved_stickers"("agent_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "saved_stickers_agent_id_source_message_id_key" ON "saved_stickers"("agent_id", "source_message_id");

-- AddForeignKey
ALTER TABLE "saved_stickers" ADD CONSTRAINT "saved_stickers_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
