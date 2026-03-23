-- Phase 3: 자재집계표 검토·보정·재처리 기능

-- AggregationStatus enum 추가
CREATE TYPE "AggregationStatus" AS ENUM ('DRAFT', 'REVIEWED', 'CONFIRMED');

-- estimate_bill_rows: 수동 보정 필드 추가
ALTER TABLE "estimate_bill_rows"
  ADD COLUMN "manualItemName"         TEXT,
  ADD COLUMN "manualSpec"             TEXT,
  ADD COLUMN "manualUnit"             TEXT,
  ADD COLUMN "manualQuantity"         DECIMAL(18,4),
  ADD COLUMN "manualGroupKey"         TEXT,
  ADD COLUMN "excludeFromAggregation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "overrideReason"         TEXT,
  ADD COLUMN "overriddenBy"           TEXT,
  ADD COLUMN "overriddenAt"           TIMESTAMP(3);

CREATE INDEX "estimate_bill_rows_manualGroupKey_idx" ON "estimate_bill_rows"("manualGroupKey");
CREATE INDEX "estimate_bill_rows_excludeFromAggregation_idx" ON "estimate_bill_rows"("excludeFromAggregation");

-- material_aggregate_rows: 상태·확정·재집계 필드 추가
ALTER TABLE "material_aggregate_rows"
  ADD COLUMN "aggregationStatus"  "AggregationStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "manualOverrideUsed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "confirmedBy"        TEXT,
  ADD COLUMN "confirmedAt"        TIMESTAMP(3),
  ADD COLUMN "regeneratedAt"      TIMESTAMP(3);

CREATE INDEX "material_aggregate_rows_aggregationStatus_idx" ON "material_aggregate_rows"("aggregationStatus");

-- estimate_row_overrides: 행 보정 이력 테이블
CREATE TABLE "estimate_row_overrides" (
  "id"          TEXT NOT NULL,
  "rowId"       TEXT NOT NULL,
  "fieldName"   TEXT NOT NULL,
  "beforeValue" TEXT,
  "afterValue"  TEXT,
  "reason"      TEXT,
  "changedBy"   TEXT NOT NULL,
  "changedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "estimate_row_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "estimate_row_overrides_rowId_idx" ON "estimate_row_overrides"("rowId");
CREATE INDEX "estimate_row_overrides_changedAt_idx" ON "estimate_row_overrides"("changedAt");

ALTER TABLE "estimate_row_overrides"
  ADD CONSTRAINT "estimate_row_overrides_rowId_fkey"
  FOREIGN KEY ("rowId") REFERENCES "estimate_bill_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- estimate_aggregation_runs: 집계 실행 이력 테이블
CREATE TABLE "estimate_aggregation_runs" (
  "id"                  TEXT NOT NULL,
  "documentId"          TEXT NOT NULL,
  "runType"             TEXT NOT NULL,
  "rowCount"            INTEGER NOT NULL DEFAULT 0,
  "aggregateCount"      INTEGER NOT NULL DEFAULT 0,
  "reviewRequiredCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"         TIMESTAMP(3),
  CONSTRAINT "estimate_aggregation_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "estimate_aggregation_runs_documentId_idx" ON "estimate_aggregation_runs"("documentId");

ALTER TABLE "estimate_aggregation_runs"
  ADD CONSTRAINT "estimate_aggregation_runs_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "estimate_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
