-- AlterTable: WorkerContract에 전자서명 이미지 필드 추가
ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "workerSignatureData" TEXT;
ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "companySignatureData" TEXT;
