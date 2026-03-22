-- Phase 6: 신분증 스캔/OCR/마스킹/권한관리

-- Enums
CREATE TYPE "IdDocumentType" AS ENUM ('NATIONAL_ID', 'DRIVER_LICENSE', 'ALIEN_REGISTRATION', 'UNKNOWN');
CREATE TYPE "IdScanStatus" AS ENUM ('UPLOADED', 'OCR_RUNNING', 'OCR_DONE', 'PARSED', 'FAILED');
CREATE TYPE "IdReviewStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'RESCAN_REQUIRED', 'ARCHIVED');
CREATE TYPE "IdentityAccessAction" AS ENUM ('UPLOAD', 'VIEW_ORIGINAL', 'VIEW_MASKED', 'DOWNLOAD_ORIGINAL', 'DOWNLOAD_MASKED', 'OCR_RUN', 'APPLY_TO_WORKER', 'VERIFY', 'REJECT', 'DELETE');

-- worker_identity_documents
CREATE TABLE "worker_identity_documents" (
  "id"               TEXT NOT NULL,
  "workerId"         TEXT NOT NULL,
  "documentType"     "IdDocumentType" NOT NULL DEFAULT 'UNKNOWN',
  "originalFileKey"  TEXT NOT NULL,
  "maskedFileKey"    TEXT,
  "thumbnailFileKey" TEXT,
  "fileMimeType"     TEXT NOT NULL,
  "fileSize"         INTEGER NOT NULL,
  "ocrRawText"       TEXT,
  "ocrRawJson"       JSONB,
  "parsedJson"       JSONB,
  "scanStatus"       "IdScanStatus" NOT NULL DEFAULT 'UPLOADED',
  "reviewStatus"     "IdReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "uploadedBy"       TEXT NOT NULL,
  "reviewedBy"       TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "rejectedReason"   TEXT,
  "isLatest"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_identity_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "worker_identity_documents_workerId_idx" ON "worker_identity_documents"("workerId");
ALTER TABLE "worker_identity_documents"
  ADD CONSTRAINT "worker_identity_documents_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- worker_sensitive_identities
CREATE TABLE "worker_sensitive_identities" (
  "id"                     TEXT NOT NULL,
  "workerId"               TEXT NOT NULL,
  "sourceDocumentId"       TEXT NOT NULL,
  "legalName"              TEXT,
  "birthDate"              TEXT,
  "gender"                 TEXT,
  "nationality"            TEXT,
  "residentType"           TEXT,
  "idNumberEncrypted"      TEXT,
  "idNumberMasked"         TEXT,
  "addressEncrypted"       TEXT,
  "addressMasked"          TEXT,
  "licenseNumberEncrypted" TEXT,
  "licenseNumberMasked"    TEXT,
  "issueDate"              TEXT,
  "expiryDate"             TEXT,
  "foreignerYn"            BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus"     "IdReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "verifiedBy"             TEXT,
  "verifiedAt"             TIMESTAMP(3),
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_sensitive_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "worker_sensitive_identities_workerId_key" ON "worker_sensitive_identities"("workerId");
CREATE UNIQUE INDEX "worker_sensitive_identities_sourceDocumentId_key" ON "worker_sensitive_identities"("sourceDocumentId");
ALTER TABLE "worker_sensitive_identities"
  ADD CONSTRAINT "worker_sensitive_identities_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_sensitive_identities"
  ADD CONSTRAINT "worker_sensitive_identities_sourceDocumentId_fkey"
  FOREIGN KEY ("sourceDocumentId") REFERENCES "worker_identity_documents"("id");

-- identity_access_logs
CREATE TABLE "identity_access_logs" (
  "id"          TEXT NOT NULL,
  "workerId"    TEXT NOT NULL,
  "documentId"  TEXT NOT NULL,
  "actionType"  "IdentityAccessAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole"   TEXT NOT NULL,
  "ipAddress"   TEXT,
  "reason"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_access_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "identity_access_logs_workerId_idx" ON "identity_access_logs"("workerId");
CREATE INDEX "identity_access_logs_documentId_idx" ON "identity_access_logs"("documentId");
ALTER TABLE "identity_access_logs"
  ADD CONSTRAINT "identity_access_logs_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "worker_identity_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- workers 컬럼 추가
ALTER TABLE "workers"
  ADD COLUMN IF NOT EXISTS "idVerificationStatus"     "IdReviewStatus",
  ADD COLUMN IF NOT EXISTS "latestIdentityDocumentId" TEXT,
  ADD COLUMN IF NOT EXISTS "identityLastReviewedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "identityLastReviewedBy"   TEXT;
