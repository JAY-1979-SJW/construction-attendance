-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('WAGE', 'ATTENDANCE', 'CONTRACT', 'TERMINATION', 'DOCUMENT_DELIVERY');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DocumentDeliveryMethod" AS ENUM ('APP_SIGNATURE', 'EMAIL', 'KAKAO', 'PAPER', 'REGISTERED_MAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentDeliveryStatus" AS ENUM ('DELIVERED', 'FAILED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkerRequestCategory" AS ENUM ('MISSING_CHECKIN', 'MISSING_CHECKOUT', 'CONTACT_CHANGE', 'CONTRACT_REVIEW', 'DOCUMENT_REQUEST', 'DEVICE_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkerRequestStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WarningLevel" AS ENUM ('VERBAL', 'WRITTEN', 'FINAL');

-- CreateEnum
CREATE TYPE "ExplanationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'REVIEWED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('CONTRACT_END', 'TERMINATION', 'SUSPENSION', 'WARNING', 'OTHER');

-- CreateEnum
CREATE TYPE "TerminationReason" AS ENUM ('CONTRACT_EXPIRY', 'VOLUNTARY_RESIGN', 'MUTUAL_AGREEMENT', 'DISCIPLINARY', 'ABSENCE', 'PERFORMANCE', 'SITE_CLOSURE', 'REPEATED_ABSENCE', 'INSTRUCTION_REFUSAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TerminationReviewStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'CONFIRMED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "ContractTemplateType_new" AS ENUM ('DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT', 'FREELANCER_SERVICE', 'OFFICE_SERVICE', 'SUBCONTRACT_WITH_BIZ', 'NONBUSINESS_TEAM_REVIEW');
ALTER TABLE "worker_contracts" ALTER COLUMN "contractTemplateType" TYPE "ContractTemplateType_new" USING ("contractTemplateType"::text::"ContractTemplateType_new");
ALTER TYPE "ContractTemplateType" RENAME TO "ContractTemplateType_old";
ALTER TYPE "ContractTemplateType_new" RENAME TO "ContractTemplateType";
DROP TYPE "ContractTemplateType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "admin_users" DROP CONSTRAINT "admin_users_company_fk";

-- DropForeignKey
ALTER TABLE "attendance_days" DROP CONSTRAINT "attendance_days_siteId_fkey";

-- DropForeignKey
ALTER TABLE "attendance_days" DROP CONSTRAINT "attendance_days_workerId_fkey";

-- DropForeignKey
ALTER TABLE "contract_versions" DROP CONSTRAINT "contract_versions_contractId_fkey";

-- DropForeignKey
ALTER TABLE "insurance_eligibility_snapshots" DROP CONSTRAINT "insurance_eligibility_snapshots_workerId_fkey";

-- DropForeignKey
ALTER TABLE "monthly_work_confirmations" DROP CONSTRAINT "monthly_work_confirmations_attendanceDayId_fkey";

-- DropForeignKey
ALTER TABLE "monthly_work_confirmations" DROP CONSTRAINT "monthly_work_confirmations_siteId_fkey";

-- DropForeignKey
ALTER TABLE "monthly_work_confirmations" DROP CONSTRAINT "monthly_work_confirmations_workerId_fkey";

-- DropForeignKey
ALTER TABLE "presence_check_audit_logs" DROP CONSTRAINT "presence_check_audit_logs_presence_check_id_fkey";

-- DropForeignKey
ALTER TABLE "retirement_mutual_daily_records" DROP CONSTRAINT "retirement_mutual_daily_records_siteId_fkey";

-- DropForeignKey
ALTER TABLE "retirement_mutual_daily_records" DROP CONSTRAINT "retirement_mutual_daily_records_sourceConfirmationId_fkey";

-- DropForeignKey
ALTER TABLE "retirement_mutual_daily_records" DROP CONSTRAINT "retirement_mutual_daily_records_workerId_fkey";

-- DropForeignKey
ALTER TABLE "safety_documents" DROP CONSTRAINT "safety_documents_contractId_fkey";

-- DropForeignKey
ALTER TABLE "safety_documents" DROP CONSTRAINT "safety_documents_siteId_fkey";

-- DropForeignKey
ALTER TABLE "safety_documents" DROP CONSTRAINT "safety_documents_workerId_fkey";

-- DropForeignKey
ALTER TABLE "temp_sensitive_document_events" DROP CONSTRAINT "temp_sensitive_document_events_documentId_fkey";

-- DropForeignKey
ALTER TABLE "temp_sensitive_documents" DROP CONSTRAINT "temp_sensitive_documents_workerId_fkey";

-- DropForeignKey
ALTER TABLE "wage_calculations" DROP CONSTRAINT "wage_calculations_workerId_fkey";

-- DropForeignKey
ALTER TABLE "withholding_calculations" DROP CONSTRAINT "withholding_calculations_wageCalculationId_fkey";

-- DropForeignKey
ALTER TABLE "withholding_calculations" DROP CONSTRAINT "withholding_calculations_workerId_fkey";

-- DropForeignKey
ALTER TABLE "worker_contracts" DROP CONSTRAINT "worker_contracts_siteId_fkey";

-- DropForeignKey
ALTER TABLE "worker_contracts" DROP CONSTRAINT "worker_contracts_workerId_fkey";

-- DropForeignKey
ALTER TABLE "worker_sensitive_identities" DROP CONSTRAINT "worker_sensitive_identities_sourceDocumentId_fkey";

-- DropForeignKey
ALTER TABLE "worker_site_assignments" DROP CONSTRAINT "worker_site_assignments_siteId_fkey";

-- DropIndex
DROP INDEX "labor_cost_summaries_companyId_idx";

-- DropIndex
DROP INDEX "worker_contracts_laborRelationType_idx";

-- DropIndex
DROP INDEX "worker_contracts_reviewFlags_idx";

-- AlterTable
ALTER TABLE "app_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "attendance_days" ALTER COLUMN "firstCheckInAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "lastCheckOutAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attendance_events" DROP COLUMN "deviceId";

-- AlterTable
ALTER TABLE "bulk_site_import_jobs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bulk_site_import_rows" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "company_settlements" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contract_versions" DROP COLUMN "changeReason",
DROP COLUMN "deliveredAt",
DROP COLUMN "deliveredBy",
DROP COLUMN "deliveryMethod",
DROP COLUMN "signedAt",
DROP COLUMN "signedBy",
DROP COLUMN "status",
DROP COLUMN "templateType",
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "filing_exports" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "insurance_eligibility_snapshots" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "insurance_rate_sources" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "lastCheckedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "lastChangeDetectedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "insurance_rate_versions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "officialAnnouncementDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reviewedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "approvedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deprecatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "monthly_work_confirmations" ALTER COLUMN "confirmedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "policy_documents" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "presence_check_audit_logs" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "presence_checks" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "reviewedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "closedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "retirement_mutual_daily_records" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "safety_documents" ALTER COLUMN "signedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "site_company_assignments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "temp_sensitive_document_events" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "temp_sensitive_documents" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "downloadedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleteScheduledAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "uploadedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_consents" DROP COLUMN "consentVersion";

-- AlterTable
ALTER TABLE "wage_calculations" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "withholding_calculations" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "worker_bank_accounts_secure" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worker_company_assignments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worker_compliance_statuses" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worker_contracts" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deliveredAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "worker_documents" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worker_identity_documents" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worker_insurance_statuses" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worker_profiles" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worker_sensitive_identities" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worker_sensitive_profiles" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "worker_site_assignments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workers" DROP COLUMN "primaryCompanyId",
DROP COLUMN "primaryTradeType";

-- CreateTable
CREATE TABLE "labor_faqs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionAliases" JSONB NOT NULL DEFAULT '[]',
    "shortAnswer" TEXT NOT NULL,
    "fullAnswer" TEXT NOT NULL,
    "appRule" TEXT,
    "caution" TEXT,
    "sourceOrg" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "effectiveDate" TEXT NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "relatedContractTypes" JSONB NOT NULL DEFAULT '[]',
    "triggerConditions" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_faq_change_logs" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeType" TEXT NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "note" TEXT,

    CONSTRAINT "labor_faq_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_cases" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT,
    "disputeType" "DisputeType" NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "openedBy" TEXT NOT NULL,
    "defenseScore" INTEGER,
    "metadataJson" JSONB,

    CONSTRAINT "dispute_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_case_notes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispute_case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defense_panel_snapshots" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "takenBy" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "defense_panel_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_delivery_logs" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "contractId" TEXT,
    "deliveryMethod" "DocumentDeliveryMethod" NOT NULL,
    "status" "DocumentDeliveryStatus" NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "deliveredBy" TEXT,
    "signatureJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_adjustment_logs" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "adjustedBy" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "reason" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_adjustment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_requests" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT,
    "siteId" TEXT,
    "category" "WorkerRequestCategory" NOT NULL,
    "status" "WorkerRequestStatus" NOT NULL DEFAULT 'PENDING',
    "content" TEXT NOT NULL,
    "adminMemo" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_warning_records" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "warningLevel" "WarningLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "detailMemo" TEXT,
    "workerAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "relatedAttendanceDate" TEXT,
    "documentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_warning_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_explanation_requests" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "ExplanationStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "workerReply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "relatedWarningId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_explanation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_notice_records" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "noticeType" "NoticeType" NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effectiveDate" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveryMethod" TEXT,
    "workerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "documentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_notice_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_termination_reviews" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "status" "TerminationReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "terminationReason" "TerminationReason",
    "terminationDate" TEXT,
    "reasonCategory" TEXT,
    "detailReason" TEXT,
    "autoCheckResultJson" JSONB,
    "confirmCheckedReason" BOOLEAN NOT NULL DEFAULT false,
    "confirmCheckedDocuments" BOOLEAN NOT NULL DEFAULT false,
    "confirmCheckedDelivery" BOOLEAN NOT NULL DEFAULT false,
    "confirmCheckedWage" BOOLEAN NOT NULL DEFAULT false,
    "confirmCheckedDispute" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_termination_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_termination_snapshots" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "takenBy" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workerJson" JSONB NOT NULL,
    "contractsJson" JSONB NOT NULL,
    "attendanceSummaryJson" JSONB NOT NULL,
    "documentsJson" JSONB NOT NULL,
    "warningsJson" JSONB NOT NULL,
    "explanationsJson" JSONB NOT NULL,
    "noticesJson" JSONB NOT NULL,
    "checklistJson" JSONB NOT NULL,

    CONSTRAINT "worker_termination_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "labor_faqs_category_idx" ON "labor_faqs"("category");

-- CreateIndex
CREATE INDEX "labor_faqs_status_isActive_idx" ON "labor_faqs"("status", "isActive");

-- CreateIndex
CREATE INDEX "labor_faqs_priority_idx" ON "labor_faqs"("priority" DESC);

-- CreateIndex
CREATE INDEX "labor_faq_change_logs_faqId_idx" ON "labor_faq_change_logs"("faqId");

-- CreateIndex
CREATE INDEX "labor_faq_change_logs_changedAt_idx" ON "labor_faq_change_logs"("changedAt");

-- CreateIndex
CREATE INDEX "dispute_cases_workerId_idx" ON "dispute_cases"("workerId");

-- CreateIndex
CREATE INDEX "dispute_cases_companyId_idx" ON "dispute_cases"("companyId");

-- CreateIndex
CREATE INDEX "dispute_cases_status_idx" ON "dispute_cases"("status");

-- CreateIndex
CREATE INDEX "dispute_cases_disputeType_idx" ON "dispute_cases"("disputeType");

-- CreateIndex
CREATE INDEX "dispute_case_notes_caseId_idx" ON "dispute_case_notes"("caseId");

-- CreateIndex
CREATE INDEX "dispute_case_notes_createdAt_idx" ON "dispute_case_notes"("createdAt");

-- CreateIndex
CREATE INDEX "defense_panel_snapshots_workerId_idx" ON "defense_panel_snapshots"("workerId");

-- CreateIndex
CREATE INDEX "defense_panel_snapshots_caseId_idx" ON "defense_panel_snapshots"("caseId");

-- CreateIndex
CREATE INDEX "defense_panel_snapshots_exportedAt_idx" ON "defense_panel_snapshots"("exportedAt");

-- CreateIndex
CREATE INDEX "document_delivery_logs_workerId_idx" ON "document_delivery_logs"("workerId");

-- CreateIndex
CREATE INDEX "document_delivery_logs_companyId_idx" ON "document_delivery_logs"("companyId");

-- CreateIndex
CREATE INDEX "document_delivery_logs_documentType_idx" ON "document_delivery_logs"("documentType");

-- CreateIndex
CREATE INDEX "document_delivery_logs_status_idx" ON "document_delivery_logs"("status");

-- CreateIndex
CREATE INDEX "attendance_adjustment_logs_attendanceRecordId_idx" ON "attendance_adjustment_logs"("attendanceRecordId");

-- CreateIndex
CREATE INDEX "attendance_adjustment_logs_workerId_idx" ON "attendance_adjustment_logs"("workerId");

-- CreateIndex
CREATE INDEX "attendance_adjustment_logs_adjustedBy_idx" ON "attendance_adjustment_logs"("adjustedBy");

-- CreateIndex
CREATE INDEX "attendance_adjustment_logs_createdAt_idx" ON "attendance_adjustment_logs"("createdAt");

-- CreateIndex
CREATE INDEX "worker_requests_workerId_idx" ON "worker_requests"("workerId");

-- CreateIndex
CREATE INDEX "worker_requests_status_idx" ON "worker_requests"("status");

-- CreateIndex
CREATE INDEX "worker_requests_category_idx" ON "worker_requests"("category");

-- CreateIndex
CREATE INDEX "worker_requests_createdAt_idx" ON "worker_requests"("createdAt");

-- CreateIndex
CREATE INDEX "worker_warning_records_workerId_idx" ON "worker_warning_records"("workerId");

-- CreateIndex
CREATE INDEX "worker_warning_records_companyId_idx" ON "worker_warning_records"("companyId");

-- CreateIndex
CREATE INDEX "worker_warning_records_createdAt_idx" ON "worker_warning_records"("createdAt");

-- CreateIndex
CREATE INDEX "worker_explanation_requests_workerId_idx" ON "worker_explanation_requests"("workerId");

-- CreateIndex
CREATE INDEX "worker_explanation_requests_companyId_idx" ON "worker_explanation_requests"("companyId");

-- CreateIndex
CREATE INDEX "worker_explanation_requests_status_idx" ON "worker_explanation_requests"("status");

-- CreateIndex
CREATE INDEX "worker_notice_records_workerId_idx" ON "worker_notice_records"("workerId");

-- CreateIndex
CREATE INDEX "worker_notice_records_companyId_idx" ON "worker_notice_records"("companyId");

-- CreateIndex
CREATE INDEX "worker_notice_records_noticeType_idx" ON "worker_notice_records"("noticeType");

-- CreateIndex
CREATE INDEX "worker_termination_reviews_workerId_idx" ON "worker_termination_reviews"("workerId");

-- CreateIndex
CREATE INDEX "worker_termination_reviews_companyId_idx" ON "worker_termination_reviews"("companyId");

-- CreateIndex
CREATE INDEX "worker_termination_reviews_status_idx" ON "worker_termination_reviews"("status");

-- CreateIndex
CREATE UNIQUE INDEX "worker_termination_snapshots_reviewId_key" ON "worker_termination_snapshots"("reviewId");

-- CreateIndex
CREATE INDEX "worker_termination_snapshots_workerId_idx" ON "worker_termination_snapshots"("workerId");

-- CreateIndex
CREATE INDEX "worker_termination_snapshots_takenAt_idx" ON "worker_termination_snapshots"("takenAt");

-- CreateIndex
CREATE INDEX "worker_devices_workerId_idx" ON "worker_devices"("workerId");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_site_assignments" ADD CONSTRAINT "worker_site_assignments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_check_audit_logs" ADD CONSTRAINT "presence_check_audit_logs_presenceCheckId_fkey" FOREIGN KEY ("presenceCheckId") REFERENCES "presence_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_contracts" ADD CONSTRAINT "worker_contracts_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_contracts" ADD CONSTRAINT "worker_contracts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_work_confirmations" ADD CONSTRAINT "monthly_work_confirmations_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_work_confirmations" ADD CONSTRAINT "monthly_work_confirmations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_work_confirmations" ADD CONSTRAINT "monthly_work_confirmations_attendanceDayId_fkey" FOREIGN KEY ("attendanceDayId") REFERENCES "attendance_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_eligibility_snapshots" ADD CONSTRAINT "insurance_eligibility_snapshots_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wage_calculations" ADD CONSTRAINT "wage_calculations_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withholding_calculations" ADD CONSTRAINT "withholding_calculations_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withholding_calculations" ADD CONSTRAINT "withholding_calculations_wageCalculationId_fkey" FOREIGN KEY ("wageCalculationId") REFERENCES "wage_calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retirement_mutual_daily_records" ADD CONSTRAINT "retirement_mutual_daily_records_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retirement_mutual_daily_records" ADD CONSTRAINT "retirement_mutual_daily_records_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retirement_mutual_daily_records" ADD CONSTRAINT "retirement_mutual_daily_records_sourceConfirmationId_fkey" FOREIGN KEY ("sourceConfirmationId") REFERENCES "monthly_work_confirmations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_sensitive_identities" ADD CONSTRAINT "worker_sensitive_identities_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "worker_identity_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temp_sensitive_documents" ADD CONSTRAINT "temp_sensitive_documents_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temp_sensitive_document_events" ADD CONSTRAINT "temp_sensitive_document_events_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "temp_sensitive_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "worker_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_documents" ADD CONSTRAINT "safety_documents_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_documents" ADD CONSTRAINT "safety_documents_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_documents" ADD CONSTRAINT "safety_documents_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "worker_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_faq_change_logs" ADD CONSTRAINT "labor_faq_change_logs_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "labor_faqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_case_notes" ADD CONSTRAINT "dispute_case_notes_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dispute_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_panel_snapshots" ADD CONSTRAINT "defense_panel_snapshots_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dispute_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_panel_snapshots" ADD CONSTRAINT "defense_panel_snapshots_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_panel_snapshots" ADD CONSTRAINT "defense_panel_snapshots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_delivery_logs" ADD CONSTRAINT "document_delivery_logs_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_delivery_logs" ADD CONSTRAINT "document_delivery_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_adjustment_logs" ADD CONSTRAINT "attendance_adjustment_logs_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_adjustment_logs" ADD CONSTRAINT "attendance_adjustment_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_requests" ADD CONSTRAINT "worker_requests_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_warning_records" ADD CONSTRAINT "worker_warning_records_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_warning_records" ADD CONSTRAINT "worker_warning_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_explanation_requests" ADD CONSTRAINT "worker_explanation_requests_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_explanation_requests" ADD CONSTRAINT "worker_explanation_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_notice_records" ADD CONSTRAINT "worker_notice_records_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_notice_records" ADD CONSTRAINT "worker_notice_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_termination_reviews" ADD CONSTRAINT "worker_termination_reviews_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_termination_reviews" ADD CONSTRAINT "worker_termination_reviews_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_termination_snapshots" ADD CONSTRAINT "worker_termination_snapshots_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "worker_termination_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_termination_snapshots" ADD CONSTRAINT "worker_termination_snapshots_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_termination_snapshots" ADD CONSTRAINT "worker_termination_snapshots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "admin_users_company_idx" RENAME TO "admin_users_companyId_idx";

-- RenameIndex
ALTER INDEX "audit_logs_company_idx" RENAME TO "audit_logs_companyId_idx";

-- RenameIndex
ALTER INDEX "insurance_rate_versions_rateType_year_idx" RENAME TO "insurance_rate_versions_rateType_effectiveYear_idx";

-- RenameIndex
ALTER INDEX "presence_check_audit_logs_created_at_idx" RENAME TO "presence_check_audit_logs_createdAt_idx";

-- RenameIndex
ALTER INDEX "presence_check_audit_logs_presence_check_id_idx" RENAME TO "presence_check_audit_logs_presenceCheckId_idx";

-- RenameIndex
ALTER INDEX "retirement_mutual_monthly_summaries_workerId_siteId_monthKey_ke" RENAME TO "retirement_mutual_monthly_summaries_workerId_siteId_monthKe_key";

