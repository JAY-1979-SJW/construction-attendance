-- CreateEnum: 사진증빙 타입
CREATE TYPE "AttendancePhotoType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum: 휴대폰 본인확인 상태 (추후 연동 대비)
CREATE TYPE "PhoneVerificationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'FAILED');

-- AlterTable worker_devices: 기기 차단 상태 + 플랫폼 정보
ALTER TABLE "worker_devices"
  ADD COLUMN IF NOT EXISTS "isBlocked"     BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blockReason"   TEXT,
  ADD COLUMN IF NOT EXISTS "blockedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "blockedBy"     TEXT,
  ADD COLUMN IF NOT EXISTS "platform"      TEXT,
  ADD COLUMN IF NOT EXISTS "browser"       TEXT,
  ADD COLUMN IF NOT EXISTS "lastLatitude"  FLOAT,
  ADD COLUMN IF NOT EXISTS "lastLongitude" FLOAT;

CREATE INDEX IF NOT EXISTS "worker_devices_isBlocked_idx" ON "worker_devices"("isBlocked");

-- AlterTable workers: 휴대폰 본인확인 상태
ALTER TABLE "workers"
  ADD COLUMN IF NOT EXISTS "phoneVerificationStatus"   "PhoneVerificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "phoneVerificationProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt"           TIMESTAMP(3);

-- CreateTable attendance_photo_evidences
CREATE TABLE IF NOT EXISTS "attendance_photo_evidences" (
    "id"              TEXT        NOT NULL,
    "attendanceLogId" TEXT,
    "workerId"        TEXT        NOT NULL,
    "siteId"          TEXT        NOT NULL,
    "photoType"       "AttendancePhotoType" NOT NULL,
    "filePath"        TEXT        NOT NULL,
    "mimeType"        TEXT        NOT NULL DEFAULT 'image/jpeg',
    "fileSizeBytes"   INTEGER,
    "sha256Hash"      TEXT,
    "capturedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude"        DOUBLE PRECISION,
    "longitude"       DOUBLE PRECISION,
    "deviceToken"     TEXT,
    "uploadedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_photo_evidences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_photo_evidences_workerId_idx"       ON "attendance_photo_evidences"("workerId");
CREATE INDEX IF NOT EXISTS "attendance_photo_evidences_attendanceLogId_idx" ON "attendance_photo_evidences"("attendanceLogId");
CREATE INDEX IF NOT EXISTS "attendance_photo_evidences_siteId_capturedAt_idx" ON "attendance_photo_evidences"("siteId", "capturedAt");

ALTER TABLE "attendance_photo_evidences"
  ADD CONSTRAINT "attendance_photo_evidences_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable future_phone_verifications (추후 NICE/KMC/KG 연동 대비)
CREATE TABLE IF NOT EXISTS "future_phone_verifications" (
    "id"            TEXT        NOT NULL,
    "workerId"      TEXT        NOT NULL,
    "provider"      TEXT        NOT NULL DEFAULT 'NOT_USED',
    "status"        "PhoneVerificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "verifiedAt"    TIMESTAMP(3),
    "ci"            TEXT,
    "di"            TEXT,
    "transactionId" TEXT,
    "rawResultRef"  TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "future_phone_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "future_phone_verifications_workerId_idx" ON "future_phone_verifications"("workerId");

ALTER TABLE "future_phone_verifications"
  ADD CONSTRAINT "future_phone_verifications_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
