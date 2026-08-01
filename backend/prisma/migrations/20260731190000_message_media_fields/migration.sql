-- AlterTable
ALTER TABLE "messages" ADD COLUMN "file_name" TEXT,
ADD COLUMN "file_size" INTEGER,
ADD COLUMN "file_key" TEXT,
ADD COLUMN "mime_type" TEXT;
