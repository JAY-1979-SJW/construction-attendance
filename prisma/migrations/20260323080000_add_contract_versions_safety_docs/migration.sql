-- ═══════════════════════════════════════════════════════════
--  v3.3 Migration: worker_contracts 확장 + contract_versions + safety_documents
-- ═══════════════════════════════════════════════════════════

-- worker_contracts 추가 컬럼
ALTER TABLE "worker_contracts"
  ADD COLUMN IF NOT EXISTS "companyBizNo"                TEXT,
  ADD COLUMN IF NOT EXISTS "companyAddress"              TEXT,
  ADD COLUMN IF NOT EXISTS "companyRepName"              TEXT,
  ADD COLUMN IF NOT EXISTS "workerBirthDate"             TEXT,
  ADD COLUMN IF NOT EXISTS "workerAddress"               TEXT,
  ADD COLUMN IF NOT EXISTS "breakStartTime"              TEXT,
  ADD COLUMN IF NOT EXISTS "breakEndTime"                TEXT,
  ADD COLUMN IF NOT EXISTS "weeklyWorkDays"              INTEGER,
  ADD COLUMN IF NOT EXISTS "weeklyWorkHours"             DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS "holidayRule"                 TEXT,
  ADD COLUMN IF NOT EXISTS "annualLeaveRule"             TEXT,
  ADD COLUMN IF NOT EXISTS "allowanceJson"               JSONB,
  ADD COLUMN IF NOT EXISTS "probationYn"                 BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "probationMonths"             INTEGER,
  ADD COLUMN IF NOT EXISTS "attendanceVerificationMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "workUnitRule"                TEXT,
  ADD COLUMN IF NOT EXISTS "rainDayRule"                 TEXT,
  ADD COLUMN IF NOT EXISTS "siteStopRule"                TEXT,
  ADD COLUMN IF NOT EXISTS "siteChangeAllowed"           BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "electronicDeliveryConsent"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "signedBy"                    TEXT,
  ADD COLUMN IF NOT EXISTS "deliveredAt"                 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "deliveredMethod"             TEXT,
  ADD COLUMN IF NOT EXISTS "currentVersion"              INTEGER NOT NULL DEFAULT 1;

-- 계약서 버전 이력 테이블
CREATE TABLE IF NOT EXISTS "contract_versions" (
  "id"             TEXT        NOT NULL PRIMARY KEY,
  "contractId"     TEXT        NOT NULL,
  "versionNo"      INTEGER     NOT NULL,
  "snapshotJson"   JSONB       NOT NULL,
  "changeNote"     TEXT,
  "draftDocId"     TEXT,
  "signedDocId"    TEXT,
  "deliveredDocId" TEXT,
  "createdBy"      TEXT        NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "contract_versions_contractId_versionNo_key" UNIQUE ("contractId", "versionNo"),
  CONSTRAINT "contract_versions_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "worker_contracts"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "contract_versions_contractId_idx" ON "contract_versions"("contractId");

-- 안전문서 타입 enum
DO $$ BEGIN
  CREATE TYPE "SafetyDocumentType" AS ENUM (
    'SAFETY_EDUCATION_NEW_HIRE',
    'SAFETY_EDUCATION_TASK_CHANGE',
    'PPE_PROVISION',
    'SAFETY_PLEDGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 안전문서 상태 enum
DO $$ BEGIN
  CREATE TYPE "SafetyDocumentStatus" AS ENUM ('DRAFT','ISSUED','SIGNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 안전문서 테이블
CREATE TABLE IF NOT EXISTS "safety_documents" (
  "id"              TEXT        NOT NULL PRIMARY KEY,
  "workerId"        TEXT        NOT NULL,
  "siteId"          TEXT,
  "contractId"      TEXT,
  "documentType"    "SafetyDocumentType" NOT NULL,
  "status"          "SafetyDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "documentDate"    TEXT,
  "educatorName"    TEXT,
  "educationPlace"  TEXT,
  "educationDate"   TEXT,
  "educationHours"  DECIMAL(4,2),
  "educationItems"  JSONB,
  "prevTask"        TEXT,
  "newTask"         TEXT,
  "issuedItemsJson" JSONB,
  "issuedBy"        TEXT,
  "contentText"     TEXT,
  "contentJson"     JSONB,
  "signedAt"        TIMESTAMPTZ,
  "signedBy"        TEXT,
  "fileId"          TEXT,
  "createdBy"       TEXT        NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "safety_documents_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE,
  CONSTRAINT "safety_documents_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL,
  CONSTRAINT "safety_documents_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "worker_contracts"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "safety_documents_workerId_idx"    ON "safety_documents"("workerId");
CREATE INDEX IF NOT EXISTS "safety_documents_siteId_idx"      ON "safety_documents"("siteId");
CREATE INDEX IF NOT EXISTS "safety_documents_contractId_idx"  ON "safety_documents"("contractId");
CREATE INDEX IF NOT EXISTS "safety_documents_documentType_idx" ON "safety_documents"("documentType");
