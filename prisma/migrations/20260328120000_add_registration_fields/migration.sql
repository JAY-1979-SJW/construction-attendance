-- OrganizationType enum에 새 값 추가
ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'DAILY_WORKER';
ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'OUTSOURCED';

-- WorkerSiteAssignment에 급여형태/근무형태 필드 추가
ALTER TABLE "worker_site_assignments" ADD COLUMN IF NOT EXISTS "wageType" TEXT;
ALTER TABLE "worker_site_assignments" ADD COLUMN IF NOT EXISTS "workType" TEXT;
