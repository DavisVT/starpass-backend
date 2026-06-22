-- AlterTable
ALTER TABLE "creators" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "creators" ADD COLUMN "featured_order" INTEGER NOT NULL DEFAULT 0;