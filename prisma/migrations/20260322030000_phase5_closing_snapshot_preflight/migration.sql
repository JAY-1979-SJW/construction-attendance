-- Phase 5: Month closing snapshot + preflight check + status extensions

-- month_closings: add CLOSING state fields
ALTER TABLE "month_closings"
  ADD COLUMN IF NOT EXISTS "closingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closingStartedBy" TEXT;

-- subcontractor_settlements: add status
ALTER TABLE "subcontractor_settlements"
  ADD COLUMN IF NOT EXISTS "status"      TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "reviewNote"  TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "confirmedBy" TEXT;

-- filing_exports: add tracking fields
ALTER TABLE "filing_exports"
  ADD COLUMN IF NOT EXISTS "siteId"              TEXT,
  ADD COLUMN IF NOT EXISTS "yearMonth"           TEXT,
  ADD COLUMN IF NOT EXISTS "lastDownloadedBy"    TEXT,
  ADD COLUMN IF NOT EXISTS "lastPreflightStatus" TEXT;

-- onboarding_checklists: add severity
ALTER TABLE "onboarding_checklists"
  ADD COLUMN IF NOT EXISTS "severity"  TEXT NOT NULL DEFAULT 'WARNING',
  ADD COLUMN IF NOT EXISTS "issueCode" TEXT;

-- month_closing_snapshots
CREATE TABLE "month_closing_snapshots" (
  "id"           TEXT NOT NULL,
  "closingId"    TEXT NOT NULL,
  "siteId"       TEXT,
  "monthKey"     TEXT NOT NULL,
  "snapshotType" TEXT NOT NULL,
  "payloadJson"  JSONB NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"    TEXT,
  CONSTRAINT "month_closing_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "month_closing_snapshots_closingId_idx" ON "month_closing_snapshots"("closingId");
CREATE INDEX "month_closing_snapshots_monthKey_idx" ON "month_closing_snapshots"("monthKey");
ALTER TABLE "month_closing_snapshots"
  ADD CONSTRAINT "month_closing_snapshots_closingId_fkey"
  FOREIGN KEY ("closingId") REFERENCES "month_closings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "month_closing_snapshots"
  ADD CONSTRAINT "month_closing_snapshots_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- preflight_check_runs
CREATE TABLE "preflight_check_runs" (
  "id"                TEXT NOT NULL,
  "siteId"            TEXT,
  "monthKey"          TEXT NOT NULL,
  "templateCode"      TEXT NOT NULL,
  "resultSummaryJson" JSONB,
  "errorCount"        INTEGER NOT NULL DEFAULT 0,
  "warningCount"      INTEGER NOT NULL DEFAULT 0,
  "infoCount"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"         TEXT,
  CONSTRAINT "preflight_check_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "preflight_check_runs_monthKey_templateCode_idx" ON "preflight_check_runs"("monthKey", "templateCode");
ALTER TABLE "preflight_check_runs"
  ADD CONSTRAINT "preflight_check_runs_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
