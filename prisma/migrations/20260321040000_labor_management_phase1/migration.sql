-- Phase 1: 노무 관리 시스템 기반 구조
-- 1) 새 enum 타입 생성
-- 2) subcontractors 테이블 생성
-- 3) workers 테이블 컬럼 추가
-- 4) 신규 테이블 9개 생성

-- ── 1. 새 Enum 타입 ──────────────────────────────────────
CREATE TYPE "EmploymentType" AS ENUM ('REGULAR', 'DAILY_CONSTRUCTION', 'BUSINESS_33', 'OTHER');
CREATE TYPE "IncomeType" AS ENUM ('SALARY', 'DAILY_WAGE', 'BUSINESS_INCOME');
CREATE TYPE "OrganizationType" AS ENUM ('DIRECT', 'SUBCONTRACTOR');
CREATE TYPE "ContractType" AS ENUM ('EMPLOYMENT', 'DAILY', 'SERVICE');
CREATE TYPE "WorkConfirmationStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'EXCLUDED');
CREATE TYPE "ConfirmedWorkType" AS ENUM ('FULL_DAY', 'HALF_DAY', 'OVERTIME', 'NIGHT', 'HOLIDAY', 'INVALID');
CREATE TYPE "AttendanceDayPresenceStatus" AS ENUM ('NORMAL', 'REVIEW_REQUIRED', 'OUT_OF_GEOFENCE', 'NO_RESPONSE', 'MISSING_CHECKOUT', 'INVALID');
CREATE TYPE "FilingExportType" AS ENUM ('DAILY_WAGE_NTS', 'BUSINESS_INCOME_NTS', 'EI_DAILY_REPORT', 'NP_BASE', 'HI_BASE', 'RETIREMENT_MUTUAL_BASE');

-- ── 2. subcontractors 테이블 ─────────────────────────────
CREATE TABLE "subcontractors" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "businessNumber" TEXT,
  "contactName"    TEXT,
  "phone"          TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "subcontractors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subcontractors_businessNumber_key"
  ON "subcontractors"("businessNumber")
  WHERE "businessNumber" IS NOT NULL;

-- ── 3. workers 테이블 컬럼 추가 ──────────────────────────
ALTER TABLE "workers"
  ADD COLUMN IF NOT EXISTS "residentIdMasked"         TEXT,
  ADD COLUMN IF NOT EXISTS "foreignerYn"              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "nationalityCode"          TEXT DEFAULT 'KR',
  ADD COLUMN IF NOT EXISTS "bankName"                 TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccount"              TEXT,
  ADD COLUMN IF NOT EXISTS "employmentType"           "EmploymentType" NOT NULL DEFAULT 'DAILY_CONSTRUCTION',
  ADD COLUMN IF NOT EXISTS "incomeType"               "IncomeType" NOT NULL DEFAULT 'DAILY_WAGE',
  ADD COLUMN IF NOT EXISTS "organizationType"         "OrganizationType" NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS "subcontractorId"          TEXT,
  ADD COLUMN IF NOT EXISTS "skillLevel"               TEXT,
  ADD COLUMN IF NOT EXISTS "retirementMutualTargetYn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fourInsurancesEligibleYn" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "workers"
  ADD CONSTRAINT "workers_subcontractorId_fkey"
  FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE SET NULL;

-- ── 4. worker_contracts 테이블 ───────────────────────────
CREATE TABLE "worker_contracts" (
  "id"                       TEXT NOT NULL,
  "workerId"                 TEXT NOT NULL,
  "siteId"                   TEXT,
  "contractType"             "ContractType" NOT NULL DEFAULT 'DAILY',
  "startDate"                TEXT NOT NULL,
  "endDate"                  TEXT,
  "dailyWage"                INTEGER NOT NULL DEFAULT 0,
  "monthlySalary"            INTEGER,
  "hourlyRate"               INTEGER,
  "overtimeRate"             DECIMAL(4,2),
  "nightRate"                DECIMAL(4,2),
  "holidayRate"              DECIMAL(4,2),
  "halfDayRule"              TEXT NOT NULL DEFAULT 'HALF',
  "taxRuleType"              TEXT NOT NULL DEFAULT 'DAILY_WAGE',
  "insuranceRuleType"        TEXT NOT NULL DEFAULT 'DEFAULT',
  "retirementMutualRuleType" TEXT NOT NULL DEFAULT 'DEFAULT',
  "notes"                    TEXT,
  "isActive"                 BOOLEAN NOT NULL DEFAULT true,
  "createdAt"                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "worker_contracts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "worker_contracts_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE,
  CONSTRAINT "worker_contracts_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL
);
CREATE INDEX "worker_contracts_workerId_idx" ON "worker_contracts"("workerId");
CREATE INDEX "worker_contracts_siteId_idx" ON "worker_contracts"("siteId");
CREATE INDEX "worker_contracts_startDate_idx" ON "worker_contracts"("startDate");

-- ── 5. attendance_days 테이블 ────────────────────────────
CREATE TABLE "attendance_days" (
  "id"                       TEXT NOT NULL,
  "workerId"                 TEXT NOT NULL,
  "siteId"                   TEXT NOT NULL,
  "workDate"                 TEXT NOT NULL,
  "firstCheckInAt"           TIMESTAMP WITH TIME ZONE,
  "lastCheckOutAt"           TIMESTAMP WITH TIME ZONE,
  "workedMinutesRaw"         INTEGER,
  "presenceStatus"           "AttendanceDayPresenceStatus" NOT NULL DEFAULT 'NORMAL',
  "presenceReviewResult"     TEXT,
  "attendanceSourceSummary"  JSONB,
  "hasMoveBetweenSites"      BOOLEAN NOT NULL DEFAULT false,
  "manualAdjustedYn"         BOOLEAN NOT NULL DEFAULT false,
  "manualAdjustedReason"     TEXT,
  "createdAt"                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_days_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_days_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "attendance_days_workerId_siteId_workDate_key"
  ON "attendance_days"("workerId", "siteId", "workDate");
CREATE INDEX "attendance_days_workerId_workDate_idx" ON "attendance_days"("workerId", "workDate");
CREATE INDEX "attendance_days_siteId_workDate_idx" ON "attendance_days"("siteId", "workDate");

-- ── 6. monthly_work_confirmations 테이블 ─────────────────
CREATE TABLE "monthly_work_confirmations" (
  "id"                             TEXT NOT NULL,
  "workerId"                       TEXT NOT NULL,
  "siteId"                         TEXT NOT NULL,
  "workDate"                       TEXT NOT NULL,
  "monthKey"                       TEXT NOT NULL,
  "attendanceDayId"                TEXT,
  "confirmationStatus"             "WorkConfirmationStatus" NOT NULL DEFAULT 'DRAFT',
  "confirmedWorkType"              "ConfirmedWorkType",
  "confirmedWorkUnits"             DECIMAL(4,2) NOT NULL DEFAULT 0,
  "confirmedWorkMinutes"           INTEGER NOT NULL DEFAULT 0,
  "confirmedBaseAmount"            INTEGER NOT NULL DEFAULT 0,
  "confirmedAllowanceAmount"       INTEGER NOT NULL DEFAULT 0,
  "confirmedTotalAmount"           INTEGER NOT NULL DEFAULT 0,
  "incomeTypeSnapshot"             TEXT,
  "employmentTypeSnapshot"         TEXT,
  "retirementMutualTargetSnapshot" BOOLEAN,
  "insuranceReviewSnapshotJson"    JSONB,
  "confirmedBy"                    TEXT,
  "confirmedAt"                    TIMESTAMP WITH TIME ZONE,
  "notes"                          TEXT,
  "createdAt"                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "monthly_work_confirmations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_work_confirmations_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE,
  CONSTRAINT "monthly_work_confirmations_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT,
  CONSTRAINT "monthly_work_confirmations_attendanceDayId_fkey"
    FOREIGN KEY ("attendanceDayId") REFERENCES "attendance_days"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "monthly_work_confirmations_workerId_siteId_workDate_key"
  ON "monthly_work_confirmations"("workerId", "siteId", "workDate");
CREATE INDEX "monthly_work_confirmations_workerId_monthKey_idx"
  ON "monthly_work_confirmations"("workerId", "monthKey");
CREATE INDEX "monthly_work_confirmations_siteId_monthKey_idx"
  ON "monthly_work_confirmations"("siteId", "monthKey");
CREATE INDEX "monthly_work_confirmations_monthKey_idx"
  ON "monthly_work_confirmations"("monthKey");

-- ── 7. insurance_eligibility_snapshots 테이블 ────────────
CREATE TABLE "insurance_eligibility_snapshots" (
  "id"                          TEXT NOT NULL,
  "workerId"                    TEXT NOT NULL,
  "monthKey"                    TEXT NOT NULL,
  "totalWorkDays"               INTEGER NOT NULL DEFAULT 0,
  "totalConfirmedAmount"        INTEGER NOT NULL DEFAULT 0,
  "nationalPensionEligible"     BOOLEAN NOT NULL DEFAULT false,
  "nationalPensionReason"       TEXT,
  "healthInsuranceEligible"     BOOLEAN NOT NULL DEFAULT false,
  "healthInsuranceReason"       TEXT,
  "employmentInsuranceEligible" BOOLEAN NOT NULL DEFAULT false,
  "employmentInsuranceReason"   TEXT,
  "industrialAccidentEligible"  BOOLEAN NOT NULL DEFAULT true,
  "industrialAccidentReason"    TEXT,
  "calculationSnapshotJson"     JSONB,
  "createdAt"                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "insurance_eligibility_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "insurance_eligibility_snapshots_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "insurance_eligibility_snapshots_workerId_monthKey_key"
  ON "insurance_eligibility_snapshots"("workerId", "monthKey");
CREATE INDEX "insurance_eligibility_snapshots_monthKey_idx"
  ON "insurance_eligibility_snapshots"("monthKey");

-- ── 8. wage_calculations 테이블 ─────────────────────────
CREATE TABLE "wage_calculations" (
  "id"                      TEXT NOT NULL,
  "workerId"                TEXT NOT NULL,
  "monthKey"                TEXT NOT NULL,
  "incomeType"              "IncomeType" NOT NULL,
  "regularDays"             DECIMAL(6,2) NOT NULL DEFAULT 0,
  "halfDays"                DECIMAL(6,2) NOT NULL DEFAULT 0,
  "overtimeMinutes"         INTEGER NOT NULL DEFAULT 0,
  "nightMinutes"            INTEGER NOT NULL DEFAULT 0,
  "holidayMinutes"          INTEGER NOT NULL DEFAULT 0,
  "grossAmount"             INTEGER NOT NULL DEFAULT 0,
  "nonTaxableAmount"        INTEGER NOT NULL DEFAULT 0,
  "taxableAmount"           INTEGER NOT NULL DEFAULT 0,
  "calculationSnapshotJson" JSONB,
  "createdAt"               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "wage_calculations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wage_calculations_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "wage_calculations_workerId_monthKey_key"
  ON "wage_calculations"("workerId", "monthKey");
CREATE INDEX "wage_calculations_monthKey_idx" ON "wage_calculations"("monthKey");

-- ── 9. withholding_calculations 테이블 ──────────────────
CREATE TABLE "withholding_calculations" (
  "id"                   TEXT NOT NULL,
  "workerId"             TEXT NOT NULL,
  "monthKey"             TEXT NOT NULL,
  "incomeType"           "IncomeType" NOT NULL,
  "grossAmount"          INTEGER NOT NULL DEFAULT 0,
  "incomeTaxAmount"      INTEGER NOT NULL DEFAULT 0,
  "localIncomeTaxAmount" INTEGER NOT NULL DEFAULT 0,
  "formulaCode"          TEXT NOT NULL,
  "formulaSnapshotJson"  JSONB,
  "wageCalculationId"    TEXT UNIQUE,
  "createdAt"            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "withholding_calculations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "withholding_calculations_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE,
  CONSTRAINT "withholding_calculations_wageCalculationId_fkey"
    FOREIGN KEY ("wageCalculationId") REFERENCES "wage_calculations"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "withholding_calculations_workerId_monthKey_key"
  ON "withholding_calculations"("workerId", "monthKey");
CREATE INDEX "withholding_calculations_monthKey_idx" ON "withholding_calculations"("monthKey");

-- ── 10. retirement_mutual_daily_records 테이블 ───────────
CREATE TABLE "retirement_mutual_daily_records" (
  "id"                   TEXT NOT NULL,
  "workerId"             TEXT NOT NULL,
  "siteId"               TEXT NOT NULL,
  "workDate"             TEXT NOT NULL,
  "monthKey"             TEXT NOT NULL,
  "eligibleYn"           BOOLEAN NOT NULL DEFAULT true,
  "recognizedWorkUnit"   DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  "sourceConfirmationId" TEXT,
  "reason"               TEXT,
  "createdAt"            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "retirement_mutual_daily_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "retirement_mutual_daily_records_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE,
  CONSTRAINT "retirement_mutual_daily_records_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT,
  CONSTRAINT "retirement_mutual_daily_records_sourceConfirmationId_fkey"
    FOREIGN KEY ("sourceConfirmationId") REFERENCES "monthly_work_confirmations"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "retirement_mutual_daily_records_workerId_siteId_workDate_key"
  ON "retirement_mutual_daily_records"("workerId", "siteId", "workDate");
CREATE INDEX "retirement_mutual_daily_records_workerId_monthKey_idx"
  ON "retirement_mutual_daily_records"("workerId", "monthKey");
CREATE INDEX "retirement_mutual_daily_records_monthKey_idx"
  ON "retirement_mutual_daily_records"("monthKey");

-- ── 11. filing_exports 테이블 ────────────────────────────
CREATE TABLE "filing_exports" (
  "id"           TEXT NOT NULL,
  "monthKey"     TEXT NOT NULL,
  "exportType"   "FilingExportType" NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "filePath"     TEXT,
  "rowCount"     INTEGER NOT NULL DEFAULT 0,
  "snapshotJson" JSONB,
  "createdBy"    TEXT,
  "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "filing_exports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "filing_exports_monthKey_idx" ON "filing_exports"("monthKey");
CREATE INDEX "filing_exports_exportType_idx" ON "filing_exports"("exportType");
