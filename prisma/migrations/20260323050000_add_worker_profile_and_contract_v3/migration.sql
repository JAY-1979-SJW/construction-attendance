-- ═══════════════════════════════════════════════════════════
--  v3 Migration: worker_profiles + worker_contracts 확장 + generated_documents
-- ═══════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "WorkerClass" AS ENUM ('EMPLOYEE', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "EmploymentMode" AS ENUM ('DAILY', 'REGULAR', 'TEMP', 'OFFICE_SUPPORT');

-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('DAILY_WAGE', 'WAGE', 'BIZ_3P3', 'OTHER_8P8');

-- CreateEnum
CREATE TYPE "InsuranceMode" AS ENUM ('AUTO_RULE', 'EMPLOYEE_4INSURANCE', 'EMPLOYMENT_ONLY', 'EXCLUDED', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "ContinuousWorkReview" AS ENUM ('OK', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "ContractKind" AS ENUM ('EMPLOYMENT', 'SERVICE', 'OUTSOURCING');

-- CreateEnum
CREATE TYPE "ContractTemplateType" AS ENUM ('DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FREELANCER_SERVICE', 'OFFICE_SERVICE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SIGNED', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "GeneratedDocumentType" AS ENUM (
  'ID_CARD', 'BANKBOOK',
  'DAILY_CONTRACT', 'REGULAR_CONTRACT', 'SERVICE_CONTRACT',
  'PAYROLL_DAILY', 'PAYROLL_REGULAR', 'PAYROLL_3P3',
  'INSURANCE_SUMMARY', 'OTHER'
);

-- ── worker_contracts 확장 컬럼 추가 ─────────────────────────
ALTER TABLE "worker_contracts"
  ADD COLUMN IF NOT EXISTS "contractKind"           "ContractKind",
  ADD COLUMN IF NOT EXISTS "contractTemplateType"   "ContractTemplateType",
  ADD COLUMN IF NOT EXISTS "contractStatus"         "ContractStatus"  NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "serviceFee"             INTEGER,
  ADD COLUMN IF NOT EXISTS "paymentDay"             INTEGER,
  ADD COLUMN IF NOT EXISTS "standardWorkHours"      DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS "breakHours"             DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS "nationalPensionYn"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "healthInsuranceYn"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "employmentInsuranceYn"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "industrialAccidentYn"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "retirementMutualYn"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "specialTerms"           TEXT,
  ADD COLUMN IF NOT EXISTS "pdfFilePath"            TEXT,
  ADD COLUMN IF NOT EXISTS "signedAt"               TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdBy"              TEXT;

-- contractStatus 인덱스
CREATE INDEX IF NOT EXISTS "worker_contracts_contractStatus_idx"
  ON "worker_contracts"("contractStatus");

-- ── worker_profiles 신규 테이블 ─────────────────────────────
CREATE TABLE IF NOT EXISTS "worker_profiles" (
  "id"                   TEXT        NOT NULL,
  "workerId"             TEXT        NOT NULL,
  "workerClass"          "WorkerClass"          NOT NULL DEFAULT 'EMPLOYEE',
  "employmentMode"       "EmploymentMode"       NOT NULL DEFAULT 'DAILY',
  "taxMode"              "TaxMode"              NOT NULL DEFAULT 'DAILY_WAGE',
  "insuranceMode"        "InsuranceMode"        NOT NULL DEFAULT 'AUTO_RULE',
  "officeWorkerYn"       BOOLEAN     NOT NULL DEFAULT false,
  "continuousWorkReview" "ContinuousWorkReview" NOT NULL DEFAULT 'OK',
  "classificationNote"   TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "worker_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "worker_profiles_workerId_key"
  ON "worker_profiles"("workerId");

ALTER TABLE "worker_profiles"
  ADD CONSTRAINT "worker_profiles_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── generated_documents 신규 테이블 ─────────────────────────
CREATE TABLE IF NOT EXISTS "generated_documents" (
  "id"           TEXT        NOT NULL,
  "workerId"     TEXT        NOT NULL,
  "contractId"   TEXT,
  "documentType" "GeneratedDocumentType" NOT NULL,
  "filePath"     TEXT        NOT NULL,
  "fileName"     TEXT        NOT NULL,
  "fileHash"     TEXT,
  "mimeType"     TEXT        NOT NULL DEFAULT 'application/pdf',
  "generatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generatedBy"  TEXT        NOT NULL,

  CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "generated_documents_workerId_idx"
  ON "generated_documents"("workerId");

CREATE INDEX IF NOT EXISTS "generated_documents_contractId_idx"
  ON "generated_documents"("contractId");

CREATE INDEX IF NOT EXISTS "generated_documents_documentType_idx"
  ON "generated_documents"("documentType");

ALTER TABLE "generated_documents"
  ADD CONSTRAINT "generated_documents_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "generated_documents"
  ADD CONSTRAINT "generated_documents_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "worker_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
