-- AlterTable
ALTER TABLE "canned_responses" ALTER COLUMN "content" SET DEFAULT '';

-- AlterTable
ALTER TABLE "canned_responses" ADD COLUMN "file_key" TEXT;
ALTER TABLE "canned_responses" ADD COLUMN "file_name" TEXT;
ALTER TABLE "canned_responses" ADD COLUMN "mime_type" TEXT;
ALTER TABLE "canned_responses" ADD COLUMN "file_size" INTEGER;
