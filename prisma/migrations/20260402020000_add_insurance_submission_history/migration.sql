-- CreateEnum
CREATE TYPE "InsuranceSubmissionType" AS ENUM ('ACQUISITION', 'LOSS', 'CHANGE', 'MONTHLY_REPORT');
CREATE TYPE "InsuranceSubmissionTarget" AS ENUM ('NATIONAL_PENSION', 'HEALTH_INSURANCE', 'EMPLOYMENT_INSURANCE', 'INDUSTRIAL_ACCIDENT');
CREATE TYPE "InsuranceSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "insurance_submission_histories" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT,
    "monthKey" TEXT NOT NULL,
    "submissionType" "InsuranceSubmissionType" NOT NULL,
    "insuranceType" "InsuranceSubmissionTarget" NOT NULL,
    "status" "InsuranceSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "filingExportId" TEXT,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "submittedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_submission_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_submission_histories_workerId_monthKey_idx" ON "insurance_submission_histories"("workerId", "monthKey");
CREATE INDEX "insurance_submission_histories_companyId_monthKey_idx" ON "insurance_submission_histories"("companyId", "monthKey");
CREATE INDEX "insurance_submission_histories_submissionType_status_idx" ON "insurance_submission_histories"("submissionType", "status");

-- AddForeignKey
ALTER TABLE "insurance_submission_histories" ADD CONSTRAINT "insurance_submission_histories_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insurance_submission_histories" ADD CONSTRAINT "insurance_submission_histories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "insurance_submission_histories" ADD CONSTRAINT "insurance_submission_histories_filingExportId_fkey" FOREIGN KEY ("filingExportId") REFERENCES "filing_exports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
