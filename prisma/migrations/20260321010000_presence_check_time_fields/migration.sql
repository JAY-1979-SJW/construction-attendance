-- AppSettings: AM/PM 시간 범위 필드 추가
ALTER TABLE "app_settings"
  ADD COLUMN "presenceCheckAmStart" TEXT NOT NULL DEFAULT '09:30',
  ADD COLUMN "presenceCheckAmEnd"   TEXT NOT NULL DEFAULT '11:30',
  ADD COLUMN "presenceCheckPmStart" TEXT NOT NULL DEFAULT '13:30',
  ADD COLUMN "presenceCheckPmEnd"   TEXT NOT NULL DEFAULT '16:30';

-- PresenceCheck: checkDate 필드 추가 (기존 데이터 없으므로 빈 기본값 임시 허용 후 제약)
ALTER TABLE "presence_checks"
  ADD COLUMN "checkDate" TEXT NOT NULL DEFAULT '';

-- 기존 unique 인덱스 삭제 후 새 인덱스 생성
DROP INDEX IF EXISTS "presence_checks_workerId_attendanceLogId_timeBucket_key";

CREATE UNIQUE INDEX "presence_checks_attendanceLogId_checkDate_timeBucket_key"
  ON "presence_checks"("attendanceLogId", "checkDate", "timeBucket");

-- 빈 기본값 제거 (이후 INSERT는 반드시 checkDate 제공해야 함)
ALTER TABLE "presence_checks" ALTER COLUMN "checkDate" DROP DEFAULT;
