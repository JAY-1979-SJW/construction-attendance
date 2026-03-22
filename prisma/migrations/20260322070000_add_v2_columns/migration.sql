-- v2 누락 컬럼 추가 및 제약 조건 수정
-- 직접 출근/퇴근(GPS), 기기 관리 고도화, Worker 기본 회사 필드

-- ─── 1. attendance_logs — 직접출근 GPS 검증 필드 ──────────
-- QR 없는 직접 출근 시 qrToken이 null이므로 NOT NULL 제거
ALTER TABLE "attendance_logs" ALTER COLUMN "qrToken" DROP NOT NULL;

ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "checkInWithinRadius"  BOOLEAN;
ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "checkOutWithinRadius" BOOLEAN;
ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "deviceTokenSnapshot"  TEXT;

-- ─── 2. attendance_events — GPS 검증 및 사유 필드 ─────────
ALTER TABLE "attendance_events"
  ADD COLUMN IF NOT EXISTS "withinRadius"         BOOLEAN;
ALTER TABLE "attendance_events"
  ADD COLUMN IF NOT EXISTS "reason"               TEXT;
ALTER TABLE "attendance_events"
  ADD COLUMN IF NOT EXISTS "deviceTokenSnapshot"  TEXT;

-- ─── 3. worker_devices — 기기 승인/해제 이력 필드 ─────────
-- fingerprintHash: 기기 지문 (선택)
ALTER TABLE "worker_devices"
  ADD COLUMN IF NOT EXISTS "fingerprintHash"      TEXT;
-- approvedAt/By: 관리자 승인 시각 및 승인자
ALTER TABLE "worker_devices"
  ADD COLUMN IF NOT EXISTS "approvedAt"           TIMESTAMP(3);
ALTER TABLE "worker_devices"
  ADD COLUMN IF NOT EXISTS "approvedBy"           TEXT;
-- revokedAt/revokeReason: 기기 해제 이력
ALTER TABLE "worker_devices"
  ADD COLUMN IF NOT EXISTS "revokedAt"            TIMESTAMP(3);
ALTER TABLE "worker_devices"
  ADD COLUMN IF NOT EXISTS "revokeReason"         TEXT;

-- ─── 4. workers — 기본 소속 회사 / 직종 스냅샷 ────────────
ALTER TABLE "workers"
  ADD COLUMN IF NOT EXISTS "primaryCompanyId"     TEXT;
ALTER TABLE "workers"
  ADD COLUMN IF NOT EXISTS "primaryTradeType"     TEXT;
