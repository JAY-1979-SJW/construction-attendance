-- CreateTable: bulk_worker_import_jobs
CREATE TABLE "bulk_worker_import_jobs" (
    "id" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "status" "BulkImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "okRows" INTEGER NOT NULL DEFAULT 0,
    "reviewRows" INTEGER NOT NULL DEFAULT 0,
    "blockRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_worker_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bulk_worker_import_rows
CREATE TABLE "bulk_worker_import_rows" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "employmentType" TEXT,
    "organizationType" TEXT,
    "birthDate" TEXT,
    "foreignerYn" BOOLEAN NOT NULL DEFAULT false,
    "skillLevel" TEXT,
    "subcontractorName" TEXT,
    "note" TEXT,
    "normalizedPhone" TEXT,
    "normalizedName" TEXT,
    "normalizedBirth" TEXT,
    "dedupeStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "dedupeReason" TEXT,
    "matchedWorkerId" TEXT,
    "matchedWorkerName" TEXT,
    "candidatesJson" JSONB,
    "aiDecision" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiExplanation" TEXT,
    "userDecision" TEXT,
    "validationStatus" "BulkImportRowValidationStatus" NOT NULL DEFAULT 'READY',
    "validationMessage" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "importedWorkerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_worker_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulk_worker_import_jobs_createdAt_idx" ON "bulk_worker_import_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "bulk_worker_import_rows_jobId_dedupeStatus_idx" ON "bulk_worker_import_rows"("jobId", "dedupeStatus");

-- CreateIndex
CREATE INDEX "bulk_worker_import_rows_jobId_validationStatus_idx" ON "bulk_worker_import_rows"("jobId", "validationStatus");

-- AddForeignKey
ALTER TABLE "bulk_worker_import_rows" ADD CONSTRAINT "bulk_worker_import_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "bulk_worker_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_worker_import_rows" ADD CONSTRAINT "bulk_worker_import_rows_importedWorkerId_fkey" FOREIGN KEY ("importedWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: bulk_site_import_rows — dedupe 관련 컬럼 추가
ALTER TABLE "bulk_site_import_rows" ADD COLUMN "dedupeStatus" TEXT;
ALTER TABLE "bulk_site_import_rows" ADD COLUMN "dedupeReason" TEXT;
ALTER TABLE "bulk_site_import_rows" ADD COLUMN "matchedSiteId" TEXT;
ALTER TABLE "bulk_site_import_rows" ADD COLUMN "matchedSiteName" TEXT;
ALTER TABLE "bulk_site_import_rows" ADD COLUMN "candidatesJson" JSONB;
ALTER TABLE "bulk_site_import_rows" ADD COLUMN "aiDecision" TEXT;
ALTER TABLE "bulk_site_import_rows" ADD COLUMN "aiConfidence" DOUBLE PRECISION;
ALTER TABLE "bulk_site_import_rows" ADD COLUMN "aiExplanation" TEXT;
ALTER TABLE "bulk_site_import_rows" ADD COLUMN "userDecision" TEXT;
