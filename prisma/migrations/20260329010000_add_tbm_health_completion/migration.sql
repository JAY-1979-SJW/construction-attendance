-- WorkerDailyReport: TBM 확인, 건강이상 없음 확인, 작업완료 사진
ALTER TABLE "worker_daily_reports" ADD COLUMN IF NOT EXISTS "tbmConfirmedYn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "worker_daily_reports" ADD COLUMN IF NOT EXISTS "tbmConfirmedAt" TIMESTAMP(3);
ALTER TABLE "worker_daily_reports" ADD COLUMN IF NOT EXISTS "healthCheckedYn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "worker_daily_reports" ADD COLUMN IF NOT EXISTS "healthCheckedAt" TIMESTAMP(3);
ALTER TABLE "worker_daily_reports" ADD COLUMN IF NOT EXISTS "workCompletionPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[];
