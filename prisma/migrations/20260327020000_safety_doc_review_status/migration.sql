-- AlterEnum: 안전문서 상태에 검토/승인/반려 추가
ALTER TYPE "SafetyDocumentStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUESTED';
ALTER TYPE "SafetyDocumentStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "SafetyDocumentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- AlterTable: 검토 관련 컬럼 추가
ALTER TABLE "safety_documents" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "safety_documents" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "safety_documents" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
