-- AddColumn: Worker 실무 필수 항목 (입사일, 비상연락처, 소속팀, 팀장, 반장)
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "hireDate" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "teamName" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "supervisorName" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "foremanName" TEXT;

-- AddValue: AdminRole enum에 TEAM_LEADER, FOREMAN 추가
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TEAM_LEADER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AdminRole')) THEN
    ALTER TYPE "AdminRole" ADD VALUE 'TEAM_LEADER';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FOREMAN' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AdminRole')) THEN
    ALTER TYPE "AdminRole" ADD VALUE 'FOREMAN';
  END IF;
END $$;

-- AddColumn: AdminUser.teamName (TEAM_LEADER/FOREMAN 전용)
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "teamName" TEXT;
