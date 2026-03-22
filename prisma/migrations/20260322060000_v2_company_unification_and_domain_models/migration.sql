-- v2 Company 단일화 및 도메인 모델 통합
-- Subcontractor → Company 전환, v2 핵심 테이블 신규 생성

-- ─── 1. 신규 Enums ────────────────────────────────────────

CREATE TYPE "CompanyType" AS ENUM (
  'SELF', 'PARTNER', 'SUBCONTRACTOR', 'SECOND_TIER_SUBCONTRACTOR',
  'LABOR_AGENCY', 'SOLE_PROPRIETOR', 'OTHER'
);

CREATE TYPE "WorkerCompanyEmploymentType" AS ENUM (
  'DIRECT', 'SUBCONTRACT', 'SECOND_TIER', 'DAILY', 'REGULAR', 'OUTSOURCED'
);

CREATE TYPE "ContractorTierType" AS ENUM ('PRIME', 'TIER1', 'TIER2', 'OTHER');

CREATE TYPE "SiteContractType" AS ENUM (
  'DIRECT_WORK', 'SUBCONTRACT', 'SUPPLY', 'SERVICE', 'OTHER'
);

CREATE TYPE "InsuranceEnrollStatus" AS ENUM (
  'ENROLLED', 'NOT_ENROLLED', 'EXEMPT', 'PENDING', 'DOCUMENT_PENDING', 'LOST', 'UNKNOWN'
);

CREATE TYPE "InsuranceReportingStatus" AS ENUM (
  'NOT_CHECKED', 'VERIFIED', 'ACQUISITION_REQUIRED', 'LOSS_REQUIRED', 'EXCEPTION_REVIEW_REQUIRED'
);

CREATE TYPE "WorkerDocumentType" AS ENUM (
  'ID_CARD', 'INSURANCE_DOC', 'CONTRACT', 'SAFETY_CERT', 'OTHER'
);

CREATE TYPE "WorkerDocumentStatus" AS ENUM (
  'UPLOADED', 'REVIEW_PENDING', 'APPROVED', 'NEEDS_SUPPLEMENT', 'EXPIRED'
);

CREATE TYPE "BulkImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

CREATE TYPE "BulkImportRowValidationStatus" AS ENUM (
  'READY', 'NEEDS_REVIEW', 'FAILED', 'APPROVED', 'IMPORTED'
);

CREATE TYPE "AuditActorType" AS ENUM ('ADMIN', 'WORKER', 'SYSTEM');

-- ─── 2. AttendanceEventType 새 값 추가 ───────────────────

ALTER TYPE "AttendanceEventType" ADD VALUE IF NOT EXISTS 'EXCEPTION_CHECK_OUT';
ALTER TYPE "AttendanceEventType" ADD VALUE IF NOT EXISTS 'ADMIN_ADJUSTMENT';

-- ─── 3. companies 테이블 생성 ─────────────────────────────

CREATE TABLE "companies" (
  "id"                 TEXT NOT NULL,
  "companyCode"        TEXT,
  "companyName"        TEXT NOT NULL,
  "businessNumber"     TEXT,
  "corpNumber"         TEXT,
  "representativeName" TEXT,
  "companyType"        "CompanyType" NOT NULL DEFAULT 'OTHER',
  "contactName"        TEXT,
  "contactPhone"       TEXT,
  "email"              TEXT,
  "address"            TEXT,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "notes"              TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "companies_companyCode_key" ON "companies"("companyCode");
CREATE UNIQUE INDEX "companies_businessNumber_key" ON "companies"("businessNumber");

-- ─── 4. Worker 테이블 변경 ───────────────────────────────

-- subcontractorId FK 제거
ALTER TABLE "workers" DROP CONSTRAINT IF EXISTS "workers_subcontractorId_fkey";
ALTER TABLE "workers" DROP COLUMN IF EXISTS "subcontractorId";
ALTER TABLE "workers" DROP COLUMN IF EXISTS "company";

-- 신규 컬럼 추가
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "workerCode" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "idVerificationStatus" "IdReviewStatus";
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "latestIdentityDocumentId" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "identityLastReviewedAt" TIMESTAMP(3);
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "identityLastReviewedBy" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "workers_workerCode_key" ON "workers"("workerCode");

-- ─── 5. Site 테이블 변경 ─────────────────────────────────

ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "siteCode" TEXT;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "notes" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "sites_siteCode_key" ON "sites"("siteCode");

-- ─── 6. AttendanceLog 테이블 변경 ────────────────────────

ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "isDirectCheckIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "companyNameSnapshot" TEXT;
ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "employmentTypeSnapshot" TEXT;
ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "tradeTypeSnapshot" TEXT;
CREATE INDEX IF NOT EXISTS "attendance_logs_companyId_workDate_idx" ON "attendance_logs"("companyId", "workDate");

-- ─── 7. AttendanceEvent 테이블 변경 ──────────────────────

ALTER TABLE "attendance_events" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- ─── 8. WorkerCompanyAssignment 테이블 ───────────────────

CREATE TABLE "worker_company_assignments" (
  "id"             TEXT NOT NULL,
  "workerId"       TEXT NOT NULL,
  "companyId"      TEXT NOT NULL,
  "employmentType" "WorkerCompanyEmploymentType" NOT NULL DEFAULT 'DAILY',
  "contractorTier" "ContractorTierType" NOT NULL DEFAULT 'PRIME',
  "roleTitle"      TEXT,
  "validFrom"      TIMESTAMP(3) NOT NULL,
  "validTo"        TIMESTAMP(3),
  "isPrimary"      BOOLEAN NOT NULL DEFAULT false,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_company_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "worker_company_assignments_workerId_validFrom_idx" ON "worker_company_assignments"("workerId", "validFrom");
CREATE INDEX "worker_company_assignments_companyId_idx" ON "worker_company_assignments"("companyId");
ALTER TABLE "worker_company_assignments"
  ADD CONSTRAINT "worker_company_assignments_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_company_assignments"
  ADD CONSTRAINT "worker_company_assignments_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 9. SiteCompanyAssignment 테이블 ─────────────────────

CREATE TABLE "site_company_assignments" (
  "id"           TEXT NOT NULL,
  "siteId"       TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "contractType" "SiteContractType" NOT NULL DEFAULT 'SUBCONTRACT',
  "startDate"    TIMESTAMP(3) NOT NULL,
  "endDate"      TIMESTAMP(3),
  "managerName"  TEXT,
  "managerPhone" TEXT,
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_company_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "site_company_assignments_siteId_idx" ON "site_company_assignments"("siteId");
CREATE INDEX "site_company_assignments_companyId_idx" ON "site_company_assignments"("companyId");
ALTER TABLE "site_company_assignments"
  ADD CONSTRAINT "site_company_assignments_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_company_assignments"
  ADD CONSTRAINT "site_company_assignments_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 10. WorkerSiteAssignment 테이블 ─────────────────────

CREATE TABLE "worker_site_assignments" (
  "id"           TEXT NOT NULL,
  "workerId"     TEXT NOT NULL,
  "siteId"       TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "assignedFrom" TIMESTAMP(3) NOT NULL,
  "assignedTo"   TIMESTAMP(3),
  "tradeType"    TEXT,
  "isPrimary"    BOOLEAN NOT NULL DEFAULT false,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_site_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "worker_site_assignments_workerId_isActive_idx" ON "worker_site_assignments"("workerId", "isActive");
CREATE INDEX "worker_site_assignments_siteId_idx" ON "worker_site_assignments"("siteId");
CREATE INDEX "worker_site_assignments_companyId_idx" ON "worker_site_assignments"("companyId");
ALTER TABLE "worker_site_assignments"
  ADD CONSTRAINT "worker_site_assignments_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_site_assignments"
  ADD CONSTRAINT "worker_site_assignments_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_site_assignments"
  ADD CONSTRAINT "worker_site_assignments_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 11. WorkerInsuranceStatus 테이블 ────────────────────

CREATE TABLE "worker_insurance_statuses" (
  "id"                        TEXT NOT NULL,
  "workerId"                  TEXT NOT NULL,
  "companyId"                 TEXT NOT NULL,
  "nationalPensionStatus"     "InsuranceEnrollStatus" NOT NULL DEFAULT 'UNKNOWN',
  "healthInsuranceStatus"     "InsuranceEnrollStatus" NOT NULL DEFAULT 'UNKNOWN',
  "employmentInsuranceStatus" "InsuranceEnrollStatus" NOT NULL DEFAULT 'UNKNOWN',
  "industrialAccidentStatus"  "InsuranceEnrollStatus" NOT NULL DEFAULT 'UNKNOWN',
  "dailyWorkerFlag"           BOOLEAN NOT NULL DEFAULT false,
  "constructionWorkerFlag"    BOOLEAN NOT NULL DEFAULT true,
  "acquisitionDate"           TIMESTAMP(3),
  "lossDate"                  TIMESTAMP(3),
  "reportingStatus"           "InsuranceReportingStatus" NOT NULL DEFAULT 'NOT_CHECKED',
  "verificationDate"          TIMESTAMP(3),
  "verifiedBy"                TEXT,
  "notes"                     TEXT,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_insurance_statuses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "worker_insurance_statuses_workerId_idx" ON "worker_insurance_statuses"("workerId");
CREATE INDEX "worker_insurance_statuses_companyId_idx" ON "worker_insurance_statuses"("companyId");
ALTER TABLE "worker_insurance_statuses"
  ADD CONSTRAINT "worker_insurance_statuses_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_insurance_statuses"
  ADD CONSTRAINT "worker_insurance_statuses_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 12. FileRecord 테이블 ───────────────────────────────

CREATE TABLE "file_records" (
  "id"               TEXT NOT NULL,
  "storageProvider"  TEXT NOT NULL DEFAULT 'LOCAL',
  "path"             TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType"         TEXT NOT NULL,
  "sizeBytes"        INTEGER NOT NULL,
  "sha256Hash"       TEXT,
  "isEncrypted"      BOOLEAN NOT NULL DEFAULT true,
  "uploadedBy"       TEXT NOT NULL,
  "uploadedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "file_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "file_records_uploadedAt_idx" ON "file_records"("uploadedAt");

-- ─── 13. WorkerDocument 테이블 ───────────────────────────

CREATE TABLE "worker_documents" (
  "id"           TEXT NOT NULL,
  "workerId"     TEXT NOT NULL,
  "companyId"    TEXT,
  "siteId"       TEXT,
  "documentType" "WorkerDocumentType" NOT NULL,
  "fileId"       TEXT NOT NULL,
  "status"       "WorkerDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "expiresAt"    TIMESTAMP(3),
  "reviewedBy"   TEXT,
  "reviewedAt"   TIMESTAMP(3),
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "worker_documents_workerId_idx" ON "worker_documents"("workerId");
CREATE INDEX "worker_documents_status_idx" ON "worker_documents"("status");
ALTER TABLE "worker_documents"
  ADD CONSTRAINT "worker_documents_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_documents"
  ADD CONSTRAINT "worker_documents_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "worker_documents"
  ADD CONSTRAINT "worker_documents_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "file_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 14. BulkSiteImportJob/Row 테이블 ────────────────────

CREATE TABLE "bulk_site_import_jobs" (
  "id"               TEXT NOT NULL,
  "uploadedBy"       TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "status"           "BulkImportJobStatus" NOT NULL DEFAULT 'PENDING',
  "totalRows"        INTEGER NOT NULL DEFAULT 0,
  "readyRows"        INTEGER NOT NULL DEFAULT 0,
  "failedRows"       INTEGER NOT NULL DEFAULT 0,
  "approvedRows"     INTEGER NOT NULL DEFAULT 0,
  "importedRows"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bulk_site_import_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bulk_site_import_jobs_createdAt_idx" ON "bulk_site_import_jobs"("createdAt");

CREATE TABLE "bulk_site_import_rows" (
  "id"                  TEXT NOT NULL,
  "jobId"               TEXT NOT NULL,
  "rowNumber"           INTEGER NOT NULL,
  "siteName"            TEXT NOT NULL,
  "rawAddress"          TEXT NOT NULL,
  "normalizedAddress"   TEXT,
  "latitude"            DOUBLE PRECISION,
  "longitude"           DOUBLE PRECISION,
  "allowedRadiusMeters" INTEGER,
  "validationStatus"    "BulkImportRowValidationStatus" NOT NULL DEFAULT 'READY',
  "validationMessage"   TEXT,
  "approvedBy"          TEXT,
  "approvedAt"          TIMESTAMP(3),
  "importedSiteId"      TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bulk_site_import_rows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bulk_site_import_rows_jobId_validationStatus_idx" ON "bulk_site_import_rows"("jobId", "validationStatus");
ALTER TABLE "bulk_site_import_rows"
  ADD CONSTRAINT "bulk_site_import_rows_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "bulk_site_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bulk_site_import_rows"
  ADD CONSTRAINT "bulk_site_import_rows_importedSiteId_fkey"
  FOREIGN KEY ("importedSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 15. AuditLog 테이블 ─────────────────────────────────

CREATE TABLE "audit_logs" (
  "id"           TEXT NOT NULL,
  "actorUserId"  TEXT,
  "actorType"    "AuditActorType" NOT NULL DEFAULT 'SYSTEM',
  "actionType"   TEXT NOT NULL,
  "targetType"   TEXT,
  "targetId"     TEXT,
  "summary"      TEXT NOT NULL,
  "metadataJson" JSONB,
  "ipAddress"    TEXT,
  "userAgent"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_actionType_idx" ON "audit_logs"("actionType");

-- ─── 16. LaborCostSummary: subcontractorId → companyId ───

ALTER TABLE "labor_cost_summaries"
  DROP CONSTRAINT IF EXISTS "labor_cost_summaries_subcontractorId_fkey";
ALTER TABLE "labor_cost_summaries" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "labor_cost_summaries" DROP COLUMN IF EXISTS "subcontractorId";
CREATE INDEX IF NOT EXISTS "labor_cost_summaries_companyId_idx" ON "labor_cost_summaries"("companyId");
ALTER TABLE "labor_cost_summaries"
  ADD CONSTRAINT "labor_cost_summaries_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 17. SubcontractorSettlement → company_settlements ────

-- 기존 테이블 제거 (파일럿 단계, 데이터 없음)
DROP TABLE IF EXISTS "subcontractor_settlements";

CREATE TABLE "company_settlements" (
  "id"                     TEXT NOT NULL,
  "monthKey"               TEXT NOT NULL,
  "siteId"                 TEXT NOT NULL,
  "companyId"              TEXT NOT NULL,
  "workerCount"            INTEGER NOT NULL DEFAULT 0,
  "confirmedWorkUnits"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "grossAmount"            INTEGER NOT NULL DEFAULT 0,
  "taxAmount"              INTEGER NOT NULL DEFAULT 0,
  "insuranceRelatedAmount" INTEGER NOT NULL DEFAULT 0,
  "retirementMutualAmount" INTEGER,
  "finalPayableAmount"     INTEGER NOT NULL DEFAULT 0,
  "snapshotJson"           JSONB,
  "status"                 TEXT NOT NULL DEFAULT 'DRAFT',
  "reviewNote"             TEXT,
  "confirmedAt"            TIMESTAMP(3),
  "confirmedBy"            TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_settlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "company_settlements_monthKey_siteId_companyId_key"
  ON "company_settlements"("monthKey", "siteId", "companyId");
CREATE INDEX "company_settlements_monthKey_idx" ON "company_settlements"("monthKey");
ALTER TABLE "company_settlements"
  ADD CONSTRAINT "company_settlements_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_settlements"
  ADD CONSTRAINT "company_settlements_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 18. Subcontractors 테이블 제거 ──────────────────────

DROP TABLE IF EXISTS "subcontractors";
