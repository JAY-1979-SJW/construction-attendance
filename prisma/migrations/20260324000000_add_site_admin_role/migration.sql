-- Migration: SITE_ADMIN 역할 추가 + site_admin_assignments 테이블
-- 파일럿 서버: psql $DATABASE_URL -f migration.sql

-- 1. AdminRole enum에 SITE_ADMIN 추가
--    PostgreSQL은 IF NOT EXISTS로 중복 실행 안전하게 처리
DO $$ BEGIN
  ALTER TYPE "AdminRole" ADD VALUE 'SITE_ADMIN';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. site_admin_assignments 테이블 생성
CREATE TABLE IF NOT EXISTS "site_admin_assignments" (
  "id"          TEXT        NOT NULL,
  "userId"      TEXT        NOT NULL,
  "companyId"   TEXT        NOT NULL,
  "siteId"      TEXT        NOT NULL,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "assignedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy"  TEXT        NOT NULL,
  "revokedAt"   TIMESTAMP(3),
  "revokedBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_admin_assignments_pkey" PRIMARY KEY ("id")
);

-- 3. 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS "site_admin_assignments_userId_siteId_key"
  ON "site_admin_assignments"("userId", "siteId");

CREATE INDEX IF NOT EXISTS "site_admin_assignments_userId_isActive_idx"
  ON "site_admin_assignments"("userId", "isActive");

CREATE INDEX IF NOT EXISTS "site_admin_assignments_siteId_idx"
  ON "site_admin_assignments"("siteId");

CREATE INDEX IF NOT EXISTS "site_admin_assignments_companyId_idx"
  ON "site_admin_assignments"("companyId");

-- 4. 외래키
DO $$ BEGIN
  ALTER TABLE "site_admin_assignments"
    ADD CONSTRAINT "site_admin_assignments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "site_admin_assignments"
    ADD CONSTRAINT "site_admin_assignments_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "site_admin_assignments"
    ADD CONSTRAINT "site_admin_assignments_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
