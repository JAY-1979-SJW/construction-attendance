-- Migration: add_checkout_site_and_events
-- 목적: 이동형 현장 근무 지원
--   1. attendance_logs에 check_out_site_id 추가 (퇴근 현장 ≠ 출근 현장 허용)
--   2. AttendanceEventType enum 추가
--   3. attendance_events 테이블 추가 (출근/이동/퇴근 이벤트 로그)
-- 주의: 기존 site_id는 출근 현장(check-in) 기준으로 유지

-- Step 1. 퇴근 현장 컬럼 추가 (nullable)
ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "checkOutSiteId" TEXT;

ALTER TABLE "attendance_logs"
  ADD CONSTRAINT "attendance_logs_checkOutSiteId_fkey"
  FOREIGN KEY ("checkOutSiteId")
  REFERENCES "sites"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- Step 2. AttendanceEventType enum 생성
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceEventType') THEN
    CREATE TYPE "AttendanceEventType" AS ENUM (
      'CHECK_IN',
      'MOVE',
      'CHECK_OUT',
      'AUTO_CHECK_OUT'
    );
  END IF;
END $$;

-- Step 3. attendance_events 테이블 생성
CREATE TABLE IF NOT EXISTS "attendance_events" (
  "id"               TEXT        NOT NULL,
  "attendanceLogId"  TEXT        NOT NULL,
  "workerId"         TEXT        NOT NULL,
  "eventType"        "AttendanceEventType" NOT NULL,
  "siteId"           TEXT,
  "occurredAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latitude"         DOUBLE PRECISION,
  "longitude"        DOUBLE PRECISION,
  "accuracy"         DOUBLE PRECISION,
  "distanceFromSite" DOUBLE PRECISION,
  "deviceId"         TEXT,
  "memo"             TEXT,

  CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_events_attendanceLogId_fkey"
    FOREIGN KEY ("attendanceLogId")
    REFERENCES "attendance_logs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_workerId_fkey"
    FOREIGN KEY ("workerId")
    REFERENCES "workers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_siteId_fkey"
    FOREIGN KEY ("siteId")
    REFERENCES "sites"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- Step 4. 인덱스
CREATE INDEX IF NOT EXISTS "attendance_events_attendanceLogId_idx"
  ON "attendance_events"("attendanceLogId");

CREATE INDEX IF NOT EXISTS "attendance_events_workerId_occurredAt_idx"
  ON "attendance_events"("workerId", "occurredAt");
