-- AlterTable: add missing platform management columns to companies
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "featureFlagsJson" JSONB;
