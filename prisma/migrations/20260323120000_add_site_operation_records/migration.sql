-- Migration: add_site_operation_records
-- Phase 3 현장 운영 기록 시스템 — enum 9종 + 모델 6종
-- Applied via prisma db push (shadow DB permission unavailable on pilot)

-- Enums
CREATE TYPE "SiteNoticeType" AS ENUM (
  'GENERAL_NOTICE',
  'SAFETY_NOTICE',
  'SCHEDULE_NOTICE',
  'INSPECTION_NOTICE',
  'MATERIAL_NOTICE',
  'ACCESS_CONTROL_NOTICE',
  'EMERGENCY_NOTICE'
);

CREATE TYPE "SiteVisibilityScope" AS ENUM (
  'ALL_WORKERS',
  'SITE_MANAGERS_ONLY',
  'HQ_AND_SITE_MANAGERS',
  'SPECIFIC_TEAM_ONLY'
);

CREATE TYPE "SiteDailyScheduleType" AS ENUM (
  'TBM',
  'INSPECTION',
  'MATERIAL_DELIVERY',
  'SAFETY_CHECK',
  'MEETING',
  'RESTRICTED_ACCESS',
  'OTHER'
);

CREATE TYPE "SiteDailyScheduleStatus" AS ENUM (
  'PLANNED',
  'IN_PROGRESS',
  'DONE',
  'CANCELED',
  'POSTPONED'
);

CREATE TYPE "SiteWorkerAttendanceStatus" AS ENUM (
  'PRESENT',
  'ABSENT',
  'LATE',
  'UNKNOWN'
);

CREATE TYPE "SiteTbmParticipationStatus" AS ENUM (
  'ATTENDED',
  'NOT_ATTENDED',
  'UNKNOWN'
);

CREATE TYPE "SiteSafetyCheckStatus" AS ENUM (
  'COMPLETED',
  'NOT_COMPLETED',
  'UNKNOWN'
);

CREATE TYPE "SiteWorkAssignedStatus" AS ENUM (
  'ASSIGNED',
  'NOT_ASSIGNED',
  'UNKNOWN'
);

CREATE TYPE "SiteWorkLogStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'RETURNED',
  'APPROVED',
  'LOCKED'
);

-- SiteNotice
CREATE TABLE "site_notices" (
  "id"               TEXT NOT NULL,
  "siteId"           TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "content"          TEXT NOT NULL,
  "noticeType"       "SiteNoticeType" NOT NULL DEFAULT 'GENERAL_NOTICE',
  "visibilityScope"  "SiteVisibilityScope" NOT NULL DEFAULT 'ALL_WORKERS',
  "targetTeamLabel"  TEXT,
  "startDate"        DATE NOT NULL,
  "endDate"          DATE,
  "isTodayHighlight" BOOLEAN NOT NULL DEFAULT false,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdById"      TEXT NOT NULL,
  "updatedById"      TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_notices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "site_notices_siteId_isActive_idx" ON "site_notices"("siteId", "isActive");
CREATE INDEX "site_notices_siteId_startDate_endDate_idx" ON "site_notices"("siteId", "startDate", "endDate");
ALTER TABLE "site_notices" ADD CONSTRAINT "site_notices_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SiteDailySchedule
CREATE TABLE "site_daily_schedules" (
  "id"                  TEXT NOT NULL,
  "siteId"              TEXT NOT NULL,
  "scheduleDate"        DATE NOT NULL,
  "scheduleType"        "SiteDailyScheduleType" NOT NULL DEFAULT 'OTHER',
  "title"               TEXT NOT NULL,
  "description"         TEXT,
  "plannedStartAt"      TIMESTAMP(3),
  "plannedEndAt"        TIMESTAMP(3),
  "location"            TEXT,
  "responsiblePersonId" TEXT,
  "targetTeamLabel"     TEXT,
  "visibilityScope"     "SiteVisibilityScope" NOT NULL DEFAULT 'ALL_WORKERS',
  "status"              "SiteDailyScheduleStatus" NOT NULL DEFAULT 'PLANNED',
  "createdById"         TEXT NOT NULL,
  "updatedById"         TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_daily_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "site_daily_schedules_siteId_scheduleDate_idx" ON "site_daily_schedules"("siteId", "scheduleDate");
CREATE INDEX "site_daily_schedules_siteId_scheduleType_idx" ON "site_daily_schedules"("siteId", "scheduleType");
ALTER TABLE "site_daily_schedules" ADD CONSTRAINT "site_daily_schedules_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SiteWorkLog
CREATE TABLE "site_work_logs" (
  "id"                    TEXT NOT NULL,
  "siteId"                TEXT NOT NULL,
  "workDate"              DATE NOT NULL,
  "status"                "SiteWorkLogStatus" NOT NULL DEFAULT 'DRAFT',
  "writtenById"           TEXT NOT NULL,
  "reviewedById"          TEXT,
  "approvedById"          TEXT,
  "summaryText"           TEXT,
  "majorWorkText"         TEXT,
  "issueText"             TEXT,
  "tbmSummaryText"        TEXT,
  "safetySummaryText"     TEXT,
  "safetyHazardText"      TEXT,
  "safetyActionText"      TEXT,
  "safetyIncidentOccurred" BOOLEAN NOT NULL DEFAULT false,
  "safetyCorrectionNeeded" BOOLEAN NOT NULL DEFAULT false,
  "safetyCorrectionDone"   BOOLEAN NOT NULL DEFAULT false,
  "inspectionSummaryText" TEXT,
  "materialSummaryText"   TEXT,
  "memoInternal"          TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_work_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "site_work_logs_siteId_workDate_key" ON "site_work_logs"("siteId", "workDate");
CREATE INDEX "site_work_logs_siteId_workDate_idx" ON "site_work_logs"("siteId", "workDate");
CREATE INDEX "site_work_logs_status_idx" ON "site_work_logs"("status");
ALTER TABLE "site_work_logs" ADD CONSTRAINT "site_work_logs_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SiteWorkLogSummary
CREATE TABLE "site_work_log_summaries" (
  "id"                           TEXT NOT NULL,
  "siteId"                       TEXT NOT NULL,
  "workDate"                     DATE NOT NULL,
  "workLogId"                    TEXT,
  "totalPresentCount"            INTEGER NOT NULL DEFAULT 0,
  "directWorkerCount"            INTEGER NOT NULL DEFAULT 0,
  "subcontractWorkerCount"       INTEGER NOT NULL DEFAULT 0,
  "teamCount"                    INTEGER NOT NULL DEFAULT 0,
  "tbmConducted"                 BOOLEAN NOT NULL DEFAULT false,
  "tbmAttendedCount"             INTEGER NOT NULL DEFAULT 0,
  "tbmAbsentCount"               INTEGER NOT NULL DEFAULT 0,
  "safetyIssueCount"             INTEGER NOT NULL DEFAULT 0,
  "inspectionPlannedCount"       INTEGER NOT NULL DEFAULT 0,
  "inspectionDoneCount"          INTEGER NOT NULL DEFAULT 0,
  "materialDeliveryPlannedCount" INTEGER NOT NULL DEFAULT 0,
  "materialDeliveryDoneCount"    INTEGER NOT NULL DEFAULT 0,
  "issueCount"                   INTEGER NOT NULL DEFAULT 0,
  "photoCount"                   INTEGER NOT NULL DEFAULT 0,
  "createdAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_work_log_summaries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "site_work_log_summaries_workLogId_key" ON "site_work_log_summaries"("workLogId");
CREATE UNIQUE INDEX "site_work_log_summaries_siteId_workDate_key" ON "site_work_log_summaries"("siteId", "workDate");
CREATE INDEX "site_work_log_summaries_siteId_workDate_idx" ON "site_work_log_summaries"("siteId", "workDate");
ALTER TABLE "site_work_log_summaries" ADD CONSTRAINT "site_work_log_summaries_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_work_log_summaries" ADD CONSTRAINT "site_work_log_summaries_workLogId_fkey"
  FOREIGN KEY ("workLogId") REFERENCES "site_work_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SiteDailyWorkerStatus
CREATE TABLE "site_daily_worker_statuses" (
  "id"                 TEXT NOT NULL,
  "siteId"             TEXT NOT NULL,
  "workDate"           DATE NOT NULL,
  "workerId"           TEXT NOT NULL,
  "companyId"          TEXT,
  "teamLabel"          TEXT,
  "attendanceLogId"    TEXT,
  "attendanceStatus"   "SiteWorkerAttendanceStatus" NOT NULL DEFAULT 'UNKNOWN',
  "checkInAt"          TIMESTAMP(3),
  "checkOutAt"         TIMESTAMP(3),
  "tbmStatus"          "SiteTbmParticipationStatus" NOT NULL DEFAULT 'UNKNOWN',
  "tbmCheckedAt"       TIMESTAMP(3),
  "safetyCheckStatus"  "SiteSafetyCheckStatus" NOT NULL DEFAULT 'UNKNOWN',
  "safetyCheckedAt"    TIMESTAMP(3),
  "workAssignedStatus" "SiteWorkAssignedStatus" NOT NULL DEFAULT 'UNKNOWN',
  "remarks"            TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_daily_worker_statuses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "site_daily_worker_statuses_siteId_workDate_workerId_key"
  ON "site_daily_worker_statuses"("siteId", "workDate", "workerId");
CREATE INDEX "site_daily_worker_statuses_siteId_workDate_idx" ON "site_daily_worker_statuses"("siteId", "workDate");
CREATE INDEX "site_daily_worker_statuses_workerId_idx" ON "site_daily_worker_statuses"("workerId");
ALTER TABLE "site_daily_worker_statuses" ADD CONSTRAINT "site_daily_worker_statuses_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_daily_worker_statuses" ADD CONSTRAINT "site_daily_worker_statuses_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SiteTbmRecord
CREATE TABLE "site_tbm_records" (
  "id"            TEXT NOT NULL,
  "siteId"        TEXT NOT NULL,
  "workDate"      DATE NOT NULL,
  "title"         TEXT NOT NULL,
  "content"       TEXT,
  "conductedAt"   TIMESTAMP(3),
  "conductorId"   TEXT,
  "attendeeCount" INTEGER NOT NULL DEFAULT 0,
  "absentCount"   INTEGER NOT NULL DEFAULT 0,
  "notes"         TEXT,
  "createdById"   TEXT NOT NULL,
  "updatedById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_tbm_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "site_tbm_records_siteId_workDate_idx" ON "site_tbm_records"("siteId", "workDate");
ALTER TABLE "site_tbm_records" ADD CONSTRAINT "site_tbm_records_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
