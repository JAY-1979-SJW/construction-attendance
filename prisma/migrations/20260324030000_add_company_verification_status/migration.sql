-- migration: 20260324030000_add_company_verification_status
-- 외부회사 사업자 인증 상태 추가

CREATE TYPE "CompanyVerificationStatus" AS ENUM (
  'DRAFT',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'INACTIVE'
);

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "externalVerificationStatus" "CompanyVerificationStatus",
  ADD COLUMN IF NOT EXISTS "verificationNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "companies_externalVerificationStatus_idx"
    ON "companies"("externalVerificationStatus");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
