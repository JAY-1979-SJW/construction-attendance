-- Phase 3: 월마감/퇴직공제/정정이력/노무비집계

-- ─── New Enums ──────────────────────────────────────────────────────────────

CREATE TYPE "MonthClosingStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED', 'REOPENED');
CREATE TYPE "ClosingScope" AS ENUM ('GLOBAL', 'SITE');
CREATE TYPE "CorrectionDomainType" AS ENUM (
  'WORK_CONFIRMATION', 'INSURANCE', 'WAGE', 'WITHHOLDING',
  'RETIREMENT_MUTUAL', 'EXPORT', 'MONTH_CLOSING'
);
CREATE TYPE "CorrectionActionType" AS ENUM (
  'CREATE', 'UPDATE', 'DELETE', 'REOPEN', 'RECALCULATE', 'MANUAL_OVERRIDE'
);
CREATE TYPE "RetirementReportStatus" AS ENUM ('READY', 'EXPORTED', 'CORRECTED');

-- Add new value to FilingExportType enum
ALTER TYPE "FilingExportType" ADD VALUE IF NOT EXISTS 'LABOR_COST_SUMMARY';

-- ─── New Tables ──────────────────────────────────────────────────────────────

-- month_closings
CREATE TABLE "month_closings" (
  "id"                          TEXT NOT NULL,
  "monthKey"                    TEXT NOT NULL,
  "siteId"                      TEXT,
  "closingScope"                "ClosingScope" NOT NULL DEFAULT 'GLOBAL',
  "status"                      "MonthClosingStatus" NOT NULL DEFAULT 'OPEN',
  "precheckPassedYn"            BOOLEAN NOT NULL DEFAULT false,
  "workConfirmationLockedYn"    BOOLEAN NOT NULL DEFAULT false,
  "insuranceLockedYn"           BOOLEAN NOT NULL DEFAULT false,
  "wageLockedYn"                BOOLEAN NOT NULL DEFAULT false,
  "retirementMutualLockedYn"    BOOLEAN NOT NULL DEFAULT false,
  "closedBy"                    TEXT,
  "closedAt"                    TIMESTAMP(3),
  "reopenedBy"                  TEXT,
  "reopenedAt"                  TIMESTAMP(3),
  "reopenReason"                TEXT,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "month_closings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "month_closings_monthKey_closingScope_siteId_key"
  ON "month_closings"("monthKey", "closingScope", "siteId");
CREATE INDEX "month_closings_monthKey_idx" ON "month_closings"("monthKey");

ALTER TABLE "month_closings"
  ADD CONSTRAINT "month_closings_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- retirement_mutual_sites
CREATE TABLE "retirement_mutual_sites" (
  "id"                      TEXT NOT NULL,
  "siteId"                  TEXT NOT NULL,
  "enabledYn"               BOOLEAN NOT NULL DEFAULT false,
  "projectType"             TEXT,
  "contractAmount"          BIGINT,
  "recognitionRuleType"     TEXT NOT NULL DEFAULT 'DEFAULT',
  "halfDayRecognitionRule"  TEXT NOT NULL DEFAULT 'INCLUDE',
  "notes"                   TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,

  CONSTRAINT "retirement_mutual_sites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "retirement_mutual_sites_siteId_key" ON "retirement_mutual_sites"("siteId");

ALTER TABLE "retirement_mutual_sites"
  ADD CONSTRAINT "retirement_mutual_sites_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- retirement_mutual_workers
CREATE TABLE "retirement_mutual_workers" (
  "id"        TEXT NOT NULL,
  "workerId"  TEXT NOT NULL,
  "enabledYn" BOOLEAN NOT NULL DEFAULT true,
  "startDate" TEXT NOT NULL,
  "endDate"   TEXT,
  "reason"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "retirement_mutual_workers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "retirement_mutual_workers_workerId_idx" ON "retirement_mutual_workers"("workerId");

ALTER TABLE "retirement_mutual_workers"
  ADD CONSTRAINT "retirement_mutual_workers_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- retirement_mutual_monthly_summaries
CREATE TABLE "retirement_mutual_monthly_summaries" (
  "id"                  TEXT NOT NULL,
  "workerId"            TEXT NOT NULL,
  "siteId"              TEXT NOT NULL,
  "monthKey"            TEXT NOT NULL,
  "recognizedWorkDays"  INTEGER NOT NULL DEFAULT 0,
  "recognizedWorkUnits" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "eligibleYn"          BOOLEAN NOT NULL DEFAULT true,
  "reportStatus"        "RetirementReportStatus" NOT NULL DEFAULT 'READY',
  "snapshotJson"        JSONB,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "retirement_mutual_monthly_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "retirement_mutual_monthly_summaries_workerId_siteId_monthKey_key"
  ON "retirement_mutual_monthly_summaries"("workerId", "siteId", "monthKey");
CREATE INDEX "retirement_mutual_monthly_summaries_monthKey_idx"
  ON "retirement_mutual_monthly_summaries"("monthKey");

ALTER TABLE "retirement_mutual_monthly_summaries"
  ADD CONSTRAINT "retirement_mutual_monthly_summaries_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retirement_mutual_monthly_summaries"
  ADD CONSTRAINT "retirement_mutual_monthly_summaries_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- correction_logs
CREATE TABLE "correction_logs" (
  "id"          TEXT NOT NULL,
  "domainType"  "CorrectionDomainType" NOT NULL,
  "domainId"    TEXT NOT NULL,
  "actionType"  "CorrectionActionType" NOT NULL,
  "beforeJson"  JSONB,
  "afterJson"   JSONB,
  "reason"      TEXT,
  "actedBy"     TEXT,
  "actedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "correction_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "correction_logs_domainType_domainId_idx" ON "correction_logs"("domainType", "domainId");
CREATE INDEX "correction_logs_actedAt_idx" ON "correction_logs"("actedAt");

-- labor_cost_summaries
CREATE TABLE "labor_cost_summaries" (
  "id"                              TEXT NOT NULL,
  "monthKey"                        TEXT NOT NULL,
  "siteId"                          TEXT NOT NULL,
  "organizationType"                "OrganizationType" NOT NULL,
  "subcontractorId"                 TEXT,
  "workerCount"                     INTEGER NOT NULL DEFAULT 0,
  "confirmedWorkUnits"              DECIMAL(10,2) NOT NULL DEFAULT 0,
  "grossAmount"                     INTEGER NOT NULL DEFAULT 0,
  "taxableAmount"                   INTEGER NOT NULL DEFAULT 0,
  "withholdingTaxAmount"            INTEGER NOT NULL DEFAULT 0,
  "nationalPensionTargetCount"      INTEGER NOT NULL DEFAULT 0,
  "healthInsuranceTargetCount"      INTEGER NOT NULL DEFAULT 0,
  "employmentInsuranceTargetCount"  INTEGER NOT NULL DEFAULT 0,
  "retirementMutualTargetDays"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"                       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "labor_cost_summaries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "labor_cost_summaries_monthKey_idx" ON "labor_cost_summaries"("monthKey");
CREATE INDEX "labor_cost_summaries_siteId_monthKey_idx" ON "labor_cost_summaries"("siteId", "monthKey");

ALTER TABLE "labor_cost_summaries"
  ADD CONSTRAINT "labor_cost_summaries_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "labor_cost_summaries"
  ADD CONSTRAINT "labor_cost_summaries_subcontractorId_fkey"
  FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Alter existing tables ────────────────────────────────────────────────────

-- retirement_mutual_daily_records: add new columns
ALTER TABLE "retirement_mutual_daily_records"
  ADD COLUMN IF NOT EXISTS "excludedReason"       TEXT,
  ADD COLUMN IF NOT EXISTS "manualOverrideYn"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "manualOverrideReason" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- filing_exports: add version management columns
ALTER TABLE "filing_exports"
  ADD COLUMN IF NOT EXISTS "monthClosingId"        TEXT,
  ADD COLUMN IF NOT EXISTS "versionNo"             INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "isLatestYn"            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "outdatedYn"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "exportScopeJson"       JSONB,
  ADD COLUMN IF NOT EXISTS "generatedSnapshotJson" JSONB;

ALTER TABLE "filing_exports"
  ADD CONSTRAINT "filing_exports_monthClosingId_fkey"
  FOREIGN KEY ("monthClosingId") REFERENCES "month_closings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
