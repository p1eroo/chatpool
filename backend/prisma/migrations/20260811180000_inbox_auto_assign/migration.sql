-- AlterTable
ALTER TABLE "inbox_settings" ADD COLUMN "auto_assign_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "inbox_agents" ADD COLUMN "auto_assign" BOOLEAN NOT NULL DEFAULT true;
