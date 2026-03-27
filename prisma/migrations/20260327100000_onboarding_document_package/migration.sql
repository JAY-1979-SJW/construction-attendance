-- CreateEnum
CREATE TYPE "DocPackageOverallStatus" AS ENUM ('NOT_READY', 'UNDER_REVIEW', 'READY', 'REJECTED', 'EXPIRED');
CREATE TYPE "OnboardingDocType" AS ENUM ('CONTRACT', 'PRIVACY_CONSENT', 'HEALTH_DECLARATION', 'HEALTH_CERTIFICATE', 'SAFETY_ACK');
CREATE TYPE "OnboardingDocStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'NOT_REQUIRED');
CREATE TYPE "DocSubmitMethod" AS ENUM ('SIGN', 'UPLOAD', 'SYSTEM_GENERATED');
CREATE TYPE "DocReviewAction" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_RESUBMIT');

-- CreateTable: worker_document_packages
CREATE TABLE "worker_document_packages" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "siteId" TEXT,
    "overallStatus" "DocPackageOverallStatus" NOT NULL DEFAULT 'NOT_READY',
    "requiredDocCount" INTEGER NOT NULL DEFAULT 5,
    "approvedDocCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedDocCount" INTEGER NOT NULL DEFAULT 0,
    "pendingDocCount" INTEGER NOT NULL DEFAULT 0,
    "missingDocCount" INTEGER NOT NULL DEFAULT 5,
    "expiredDocCount" INTEGER NOT NULL DEFAULT 0,
    "lastSubmittedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_document_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worker_onboarding_documents
CREATE TABLE "worker_onboarding_documents" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "siteId" TEXT,
    "packageId" TEXT NOT NULL,
    "docType" "OnboardingDocType" NOT NULL,
    "status" "OnboardingDocStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "versionNo" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "contractId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "rejectionReason" TEXT,
    "latestSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_onboarding_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worker_doc_submissions
CREATE TABLE "worker_doc_submissions" (
    "id" TEXT NOT NULL,
    "onboardingDocId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "docType" "OnboardingDocType" NOT NULL,
    "submissionNo" INTEGER NOT NULL,
    "statusSnapshot" "OnboardingDocStatus" NOT NULL,
    "submitMethod" "DocSubmitMethod" NOT NULL,
    "fileId" TEXT,
    "signedDocumentUrl" TEXT,
    "sourcePayload" JSONB,
    "submittedByWorkerId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_doc_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worker_doc_reviews
CREATE TABLE "worker_doc_reviews" (
    "id" TEXT NOT NULL,
    "onboardingDocId" TEXT NOT NULL,
    "submissionId" TEXT,
    "action" "DocReviewAction" NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_doc_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable: onboarding_doc_templates
CREATE TABLE "onboarding_doc_templates" (
    "id" TEXT NOT NULL,
    "docType" "OnboardingDocType" NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT,
    "contentJson" JSONB,
    "versionNo" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_doc_templates_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "worker_document_packages_workerId_siteId_key" ON "worker_document_packages"("workerId", "siteId");
CREATE INDEX "worker_document_packages_overallStatus_idx" ON "worker_document_packages"("overallStatus");

CREATE UNIQUE INDEX "worker_onboarding_documents_workerId_siteId_docType_key" ON "worker_onboarding_documents"("workerId", "siteId", "docType");
CREATE INDEX "worker_onboarding_documents_packageId_docType_idx" ON "worker_onboarding_documents"("packageId", "docType");
CREATE INDEX "worker_onboarding_documents_status_idx" ON "worker_onboarding_documents"("status");

CREATE INDEX "worker_doc_submissions_onboardingDocId_idx" ON "worker_doc_submissions"("onboardingDocId");
CREATE INDEX "worker_doc_submissions_workerId_docType_idx" ON "worker_doc_submissions"("workerId", "docType");

CREATE INDEX "worker_doc_reviews_onboardingDocId_idx" ON "worker_doc_reviews"("onboardingDocId");
CREATE INDEX "worker_doc_reviews_reviewerId_idx" ON "worker_doc_reviews"("reviewerId");

CREATE INDEX "onboarding_doc_templates_docType_isActive_idx" ON "onboarding_doc_templates"("docType", "isActive");

-- Foreign Keys
ALTER TABLE "worker_document_packages" ADD CONSTRAINT "worker_document_packages_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_document_packages" ADD CONSTRAINT "worker_document_packages_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "worker_onboarding_documents" ADD CONSTRAINT "worker_onboarding_documents_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_onboarding_documents" ADD CONSTRAINT "worker_onboarding_documents_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "worker_onboarding_documents" ADD CONSTRAINT "worker_onboarding_documents_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "worker_document_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_onboarding_documents" ADD CONSTRAINT "worker_onboarding_documents_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "worker_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "worker_doc_submissions" ADD CONSTRAINT "worker_doc_submissions_onboardingDocId_fkey" FOREIGN KEY ("onboardingDocId") REFERENCES "worker_onboarding_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_doc_submissions" ADD CONSTRAINT "worker_doc_submissions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "worker_doc_reviews" ADD CONSTRAINT "worker_doc_reviews_onboardingDocId_fkey" FOREIGN KEY ("onboardingDocId") REFERENCES "worker_onboarding_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_doc_reviews" ADD CONSTRAINT "worker_doc_reviews_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "worker_doc_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "worker_doc_reviews" ADD CONSTRAINT "worker_doc_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
