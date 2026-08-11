-- AlterEnum
ALTER TYPE "MessageContentType" ADD VALUE 'location';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "location" JSONB;
