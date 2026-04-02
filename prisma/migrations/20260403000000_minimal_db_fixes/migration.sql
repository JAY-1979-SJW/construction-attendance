-- migration: 20260403000000_minimal_db_fixes
-- 운영 최소 DB 수정: FK 추가, timestamptz 변환, 인덱스 추가

-- ① attendance_photo_evidences.siteId → sites(id) FK 추가
--    사전 고아 검사 결과: orphan 0건, 안전
ALTER TABLE "attendance_photo_evidences"
  ADD CONSTRAINT "attendance_photo_evidences_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ② correction_logs.actedAt 타입 변환: timestamp → timestamptz
ALTER TABLE "correction_logs"
  ALTER COLUMN "actedAt" TYPE TIMESTAMPTZ
  USING "actedAt" AT TIME ZONE 'Asia/Seoul';

-- ③ correction_logs.actedBy 인덱스 추가 (기존 없음)
CREATE INDEX IF NOT EXISTS "correction_logs_actedBy_idx"
  ON "correction_logs"("actedBy");

-- ④ site_company_assignments.participationStatus 인덱스 추가 (기존 없음)
CREATE INDEX IF NOT EXISTS "site_company_assignments_participationStatus_idx"
  ON "site_company_assignments"("participationStatus");
