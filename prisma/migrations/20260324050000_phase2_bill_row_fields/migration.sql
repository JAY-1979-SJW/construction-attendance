-- migration: 20260324050000_phase2_bill_row_fields
-- Phase 2: 행 분류·집계 필드 추가

ALTER TABLE "estimate_bill_rows"
  ADD COLUMN IF NOT EXISTS "headerPathJson" TEXT,
  ADD COLUMN IF NOT EXISTS "groupContextJson" TEXT,
  ADD COLUMN IF NOT EXISTS "rawRowJson" TEXT,
  ADD COLUMN IF NOT EXISTS "aggregateCandidate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reviewReasonsJson" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceCellRange" TEXT;

ALTER TABLE "material_aggregate_rows"
  ADD COLUMN IF NOT EXISTS "reviewRequired" BOOLEAN NOT NULL DEFAULT false;
