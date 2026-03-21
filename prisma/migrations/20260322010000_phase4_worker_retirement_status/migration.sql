-- Phase 4: Worker retirement mutual status

CREATE TYPE "RetirementMutualStatus" AS ENUM ('YES', 'NO', 'PENDING_REVIEW');

ALTER TABLE "workers"
  ADD COLUMN IF NOT EXISTS "retirementMutualStatus" "RetirementMutualStatus" NOT NULL DEFAULT 'PENDING_REVIEW';

-- Migrate existing data: retirementMutualTargetYn=true → YES, false → PENDING_REVIEW
UPDATE "workers" SET "retirementMutualStatus" = 'YES' WHERE "retirementMutualTargetYn" = true;
