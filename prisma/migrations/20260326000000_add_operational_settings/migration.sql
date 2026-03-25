-- AddColumn: 운영 기준 설정 필드 일괄 추가

ALTER TABLE "app_settings" ADD COLUMN "checkInStart" TEXT NOT NULL DEFAULT '07:00';
ALTER TABLE "app_settings" ADD COLUMN "checkOutEnd" TEXT NOT NULL DEFAULT '17:00';
ALTER TABLE "app_settings" ADD COLUMN "tardyMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "app_settings" ADD COLUMN "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "app_settings" ADD COLUMN "absentMarkHour" TEXT NOT NULL DEFAULT '12:00';
ALTER TABLE "app_settings" ADD COLUMN "reviewOnException" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "app_settings" ADD COLUMN "mandayFullMinutes" INTEGER NOT NULL DEFAULT 600;
ALTER TABLE "app_settings" ADD COLUMN "mandayPartialOk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "app_settings" ADD COLUMN "mandayManualOk" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_settings" ADD COLUMN "mandayAutoReview" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "app_settings" ADD COLUMN "wageByManday" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_settings" ADD COLUMN "wageMonthly" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_settings" ADD COLUMN "wageTotal" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_settings" ADD COLUMN "wageManualOk" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "app_settings" ADD COLUMN "adminDisplayName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "app_settings" ADD COLUMN "adminContact" TEXT NOT NULL DEFAULT '';
ALTER TABLE "app_settings" ADD COLUMN "requireReasonOnEdit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "app_settings" ADD COLUMN "keepEditHistory" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_settings" ADD COLUMN "confirmBeforeSave" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "app_settings" ADD COLUMN "siteDefaultStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "app_settings" ADD COLUMN "siteEndingWarnDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "app_settings" ADD COLUMN "siteDefaultSort" TEXT NOT NULL DEFAULT 'endDate_asc';
ALTER TABLE "app_settings" ADD COLUMN "siteAutoReview" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_settings" ADD COLUMN "absentAlertThreshold" INTEGER NOT NULL DEFAULT 2;
