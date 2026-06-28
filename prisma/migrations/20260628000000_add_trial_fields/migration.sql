-- AlterTable
ALTER TABLE "tiers" ADD COLUMN "trial_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "passes" ADD COLUMN "trial_used" BOOLEAN NOT NULL DEFAULT false;
