-- Phase 4: Worker exception fields + subcontractor settlements + onboarding checklists

-- Worker new fields
ALTER TABLE "workers"
  ADD COLUMN IF NOT EXISTS "residentType"             TEXT,
  ADD COLUMN IF NOT EXISTS "foreignTaxSpecialYn"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "insuranceExceptionYn"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "insuranceExceptionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "taxExceptionYn"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "taxExceptionReason"       TEXT;

-- Update foreignerYn → residentType migration
UPDATE "workers" SET "residentType" = 'FOREIGNER' WHERE "foreignerYn" = true;
UPDATE "workers" SET "residentType" = 'LOCAL' WHERE "foreignerYn" = false;

-- FilingExport new fields
ALTER TABLE "filing_exports"
  ADD COLUMN IF NOT EXISTS "templateCode"       TEXT,
  ADD COLUMN IF NOT EXISTS "fileFormat"         TEXT NOT NULL DEFAULT 'CSV',
  ADD COLUMN IF NOT EXISTS "institutionType"    TEXT,
  ADD COLUMN IF NOT EXISTS "downloadCount"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastDownloadedAt"   TIMESTAMP(3);

-- subcontractor_settlements
CREATE TABLE "subcontractor_settlements" (
  "id"                     TEXT NOT NULL,
  "monthKey"               TEXT NOT NULL,
  "siteId"                 TEXT NOT NULL,
  "subcontractorId"        TEXT NOT NULL,
  "workerCount"            INTEGER NOT NULL DEFAULT 0,
  "confirmedWorkUnits"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "grossAmount"            INTEGER NOT NULL DEFAULT 0,
  "taxAmount"              INTEGER NOT NULL DEFAULT 0,
  "insuranceRelatedAmount" INTEGER NOT NULL DEFAULT 0,
  "retirementMutualAmount" INTEGER,
  "finalPayableAmount"     INTEGER NOT NULL DEFAULT 0,
  "snapshotJson"           JSONB,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subcontractor_settlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subcontractor_settlements_monthKey_siteId_subcontractorId_key"
  ON "subcontractor_settlements"("monthKey", "siteId", "subcontractorId");
CREATE INDEX "subcontractor_settlements_monthKey_idx" ON "subcontractor_settlements"("monthKey");

ALTER TABLE "subcontractor_settlements"
  ADD CONSTRAINT "subcontractor_settlements_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subcontractor_settlements"
  ADD CONSTRAINT "subcontractor_settlements_subcontractorId_fkey"
  FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- onboarding_checklists
CREATE TABLE "onboarding_checklists" (
  "id"         TEXT NOT NULL,
  "workerId"   TEXT NOT NULL,
  "siteId"     TEXT,
  "checkType"  TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "message"    TEXT NOT NULL,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_checklists_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "onboarding_checklists_workerId_idx" ON "onboarding_checklists"("workerId");
CREATE INDEX "onboarding_checklists_status_idx" ON "onboarding_checklists"("status");

ALTER TABLE "onboarding_checklists"
  ADD CONSTRAINT "onboarding_checklists_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "onboarding_checklists"
  ADD CONSTRAINT "onboarding_checklists_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
