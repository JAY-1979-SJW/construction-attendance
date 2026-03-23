-- v3.4 Migration: worker_contracts 공사·직종·계약형태 필드 추가 + SafetyDocumentType 확장

ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "projectName" TEXT;
ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "workType" TEXT;
ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "workTypeSub" TEXT;
ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "jobCategory" TEXT;
ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "jobCategorySub" TEXT;
ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "contractForm" TEXT;
ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "taskDescription" TEXT;

DO $$ BEGIN
  ALTER TYPE "SafetyDocumentType" ADD VALUE IF NOT EXISTS 'WORK_CONDITIONS_RECEIPT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "SafetyDocumentType" ADD VALUE IF NOT EXISTS 'PRIVACY_CONSENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
