-- CreateEnum
CREATE TYPE "WorkerAccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'LOCATION_POLICY', 'MARKETING');

-- CreateEnum
CREATE TYPE "SiteJoinStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SiteJoinMethod" AS ENUM ('SITE_LIST', 'INVITE_CODE', 'QR_JOIN');

-- CreateEnum
CREATE TYPE "CompanyAdminRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable workers: accountStatus, username, email, birthDate, rejectReason, reviewedAt, reviewedBy 추가
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "accountStatus" "WorkerAccountStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "birthDate" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;

-- username unique index
CREATE UNIQUE INDEX IF NOT EXISTS "workers_username_key" ON "workers"("username");

-- AlterTable app_settings: deviceApprovalMode 추가
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "deviceApprovalMode" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateTable user_consents
CREATE TABLE IF NOT EXISTS "user_consents" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "consentVersion" TEXT NOT NULL DEFAULT '1.0',
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex user_consents
CREATE INDEX IF NOT EXISTS "user_consents_workerId_idx" ON "user_consents"("workerId");

-- AddForeignKey user_consents
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable site_join_requests
CREATE TABLE IF NOT EXISTS "site_join_requests" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT,
    "siteId" TEXT NOT NULL,
    "status" "SiteJoinStatus" NOT NULL DEFAULT 'PENDING',
    "joinMethod" "SiteJoinMethod" NOT NULL DEFAULT 'SITE_LIST',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectReason" TEXT,
    "note" TEXT,

    CONSTRAINT "site_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex site_join_requests
CREATE UNIQUE INDEX IF NOT EXISTS "site_join_requests_workerId_siteId_key" ON "site_join_requests"("workerId", "siteId");
CREATE INDEX IF NOT EXISTS "site_join_requests_siteId_status_idx" ON "site_join_requests"("siteId", "status");
CREATE INDEX IF NOT EXISTS "site_join_requests_status_idx" ON "site_join_requests"("status");

-- AddForeignKey site_join_requests
ALTER TABLE "site_join_requests" ADD CONSTRAINT "site_join_requests_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_join_requests" ADD CONSTRAINT "site_join_requests_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable company_admin_requests
CREATE TABLE IF NOT EXISTS "company_admin_requests" (
    "id" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "companyName" TEXT NOT NULL,
    "businessNumber" TEXT NOT NULL,
    "representativeName" TEXT,
    "contactPhone" TEXT,
    "jobTitle" TEXT,
    "businessLicensePath" TEXT,
    "status" "CompanyAdminRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectReason" TEXT,
    "createdAdminUserId" TEXT,
    "notes" TEXT,

    CONSTRAINT "company_admin_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex company_admin_requests
CREATE INDEX IF NOT EXISTS "company_admin_requests_status_idx" ON "company_admin_requests"("status");
CREATE INDEX IF NOT EXISTS "company_admin_requests_businessNumber_idx" ON "company_admin_requests"("businessNumber");
