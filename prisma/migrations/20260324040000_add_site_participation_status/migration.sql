-- migration: 20260324040000_add_site_participation_status
-- 현장 참여회사 참여 상태 추가

CREATE TYPE "SiteParticipationStatus" AS ENUM ('PLANNED', 'ACTIVE', 'STOPPED');

ALTER TABLE "site_company_assignments"
  ADD COLUMN IF NOT EXISTS "participationStatus" "SiteParticipationStatus" NOT NULL DEFAULT 'PLANNED';
