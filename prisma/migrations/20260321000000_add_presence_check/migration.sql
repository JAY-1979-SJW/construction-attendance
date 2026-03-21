-- CreateEnum
CREATE TYPE "TimeBucket" AS ENUM ('AM', 'PM');

-- CreateEnum
CREATE TYPE "PresenceCheckStatus" AS ENUM ('PENDING', 'COMPLETED', 'MISSED', 'OUT_OF_GEOFENCE', 'LOW_ACCURACY', 'SKIPPED');

-- CreateTable: 시스템 설정 (싱글톤)
CREATE TABLE "app_settings" (
    "id"                                TEXT NOT NULL DEFAULT 'singleton',
    "planType"                          TEXT NOT NULL DEFAULT 'FREE',
    "presenceCheckFeatureAvailable"     BOOLEAN NOT NULL DEFAULT false,
    "presenceCheckEnabled"              BOOLEAN NOT NULL DEFAULT false,
    "presenceCheckAmEnabled"            BOOLEAN NOT NULL DEFAULT true,
    "presenceCheckPmEnabled"            BOOLEAN NOT NULL DEFAULT true,
    "presenceCheckRadiusMeters"         INTEGER NOT NULL DEFAULT 30,
    "presenceCheckResponseLimitMinutes" INTEGER NOT NULL DEFAULT 20,
    "presenceCheckFailureNeedsReview"   BOOLEAN NOT NULL DEFAULT true,
    "updatedAt"                         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 중간 체류 확인 기록
CREATE TABLE "presence_checks" (
    "id"                  TEXT NOT NULL,
    "workerId"            TEXT NOT NULL,
    "attendanceLogId"     TEXT NOT NULL,
    "siteId"              TEXT NOT NULL,
    "timeBucket"          "TimeBucket" NOT NULL,
    "scheduledAt"         TIMESTAMP(3) NOT NULL,
    "expiresAt"           TIMESTAMP(3) NOT NULL,
    "status"              "PresenceCheckStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt"         TIMESTAMP(3),
    "latitude"            DOUBLE PRECISION,
    "longitude"           DOUBLE PRECISION,
    "accuracyMeters"      DOUBLE PRECISION,
    "distanceMeters"      DOUBLE PRECISION,
    "appliedRadiusMeters" INTEGER,
    "needsReview"         BOOLEAN NOT NULL DEFAULT false,
    "reviewReason"        TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presence_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presence_checks_workerId_attendanceLogId_timeBucket_key"
    ON "presence_checks"("workerId", "attendanceLogId", "timeBucket");

CREATE INDEX "presence_checks_workerId_scheduledAt_idx"
    ON "presence_checks"("workerId", "scheduledAt");

CREATE INDEX "presence_checks_attendanceLogId_idx"
    ON "presence_checks"("attendanceLogId");

CREATE INDEX "presence_checks_status_idx"
    ON "presence_checks"("status");

CREATE INDEX "presence_checks_scheduledAt_idx"
    ON "presence_checks"("scheduledAt");

-- AddForeignKey
ALTER TABLE "presence_checks" ADD CONSTRAINT "presence_checks_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "presence_checks" ADD CONSTRAINT "presence_checks_attendanceLogId_fkey"
    FOREIGN KEY ("attendanceLogId") REFERENCES "attendance_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "presence_checks" ADD CONSTRAINT "presence_checks_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default singleton row
INSERT INTO "app_settings" ("id", "updatedAt")
    VALUES ('singleton', CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING;
