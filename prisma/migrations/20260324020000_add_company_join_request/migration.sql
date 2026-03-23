-- migration: 20260324020000_add_company_join_request
-- 기존 업체 가입 신청 테이블 추가

CREATE TABLE IF NOT EXISTS "company_join_requests" (
  "id"                  TEXT NOT NULL,
  "companyId"           TEXT NOT NULL,
  "applicantName"       TEXT NOT NULL,
  "phone"               TEXT NOT NULL,
  "email"               TEXT,
  "jobTitle"            TEXT,
  "message"             TEXT,
  "status"              "CompanyAdminRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt"          TIMESTAMP(3),
  "reviewedBy"          TEXT,
  "rejectReason"        TEXT,
  "createdAdminUserId"  TEXT,

  CONSTRAINT "company_join_requests_pkey" PRIMARY KEY ("id")
);

-- indexes
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "company_join_requests_companyId_status_idx"
    ON "company_join_requests"("companyId", "status");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "company_join_requests_status_idx"
    ON "company_join_requests"("status");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- FK constraint
DO $$ BEGIN
  ALTER TABLE "company_join_requests"
    ADD CONSTRAINT "company_join_requests_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
