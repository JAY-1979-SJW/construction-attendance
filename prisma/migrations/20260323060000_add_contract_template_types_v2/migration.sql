-- ═══════════════════════════════════════════════════════════
--  v3.1 Migration: ContractTemplateType 확장 + 계약 분류 필드 추가
-- ═══════════════════════════════════════════════════════════

-- ContractTemplateType 신규 값 추가
-- PostgreSQL은 ADD VALUE IF NOT EXISTS 지원 (>=9.6)
ALTER TYPE "ContractTemplateType" ADD VALUE IF NOT EXISTS 'FIXED_TERM_EMPLOYMENT';
ALTER TYPE "ContractTemplateType" ADD VALUE IF NOT EXISTS 'SUBCONTRACT_WITH_BIZ';
ALTER TYPE "ContractTemplateType" ADD VALUE IF NOT EXISTS 'NONBUSINESS_TEAM_REVIEW';

-- worker_contracts 에 v3.1 계약 분류 컬럼 추가
ALTER TABLE "worker_contracts"
  ADD COLUMN IF NOT EXISTS "laborRelationType"               TEXT,
  ADD COLUMN IF NOT EXISTS "businessRegistrationNo"          TEXT,
  ADD COLUMN IF NOT EXISTS "contractorName"                  TEXT,
  ADD COLUMN IF NOT EXISTS "safetyClauseYn"                  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "checkInTime"                     TEXT,
  ADD COLUMN IF NOT EXISTS "checkOutTime"                    TEXT,
  ADD COLUMN IF NOT EXISTS "workDays"                        TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethod"                   TEXT,
  ADD COLUMN IF NOT EXISTS "reviewFlags"                     TEXT,
  ADD COLUMN IF NOT EXISTS "attendanceControlledByCompany"   BOOLEAN,
  ADD COLUMN IF NOT EXISTS "payDecidedByCompany"             BOOLEAN,
  ADD COLUMN IF NOT EXISTS "directPaymentByCompany"          BOOLEAN;

-- 인덱스
CREATE INDEX IF NOT EXISTS "worker_contracts_laborRelationType_idx"
  ON "worker_contracts"("laborRelationType");

CREATE INDEX IF NOT EXISTS "worker_contracts_reviewFlags_idx"
  ON "worker_contracts"("reviewFlags");
