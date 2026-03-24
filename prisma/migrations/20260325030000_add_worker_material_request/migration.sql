-- AlterEnum: MaterialRequestActorType에 WORKER 추가
ALTER TYPE "MaterialRequestActorType" ADD VALUE 'WORKER';

-- AlterTable: material_requests에 workerRequesterId 추가
ALTER TABLE "material_requests" ADD COLUMN "workerRequesterId" TEXT;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_workerRequesterId_fkey"
  FOREIGN KEY ("workerRequesterId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "material_requests_workerRequesterId_idx" ON "material_requests"("workerRequesterId");
