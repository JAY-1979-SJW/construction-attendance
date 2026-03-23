-- Migration: EXTERNAL_SITE_ADMIN role + site_access_groups
-- Created: 2026-03-24

-- 1. AdminRole enum에 EXTERNAL_SITE_ADMIN 추가
DO $$ BEGIN
  ALTER TYPE "AdminRole" ADD VALUE 'EXTERNAL_SITE_ADMIN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. site_access_groups 테이블
CREATE TABLE IF NOT EXISTS "site_access_groups" (
  "id"             TEXT         NOT NULL,
  "name"           TEXT         NOT NULL,
  "description"    TEXT,
  "ownerCompanyId" TEXT,
  "isActive"       BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "site_access_groups_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX "site_access_groups_ownerCompanyId_idx"
    ON "site_access_groups"("ownerCompanyId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. site_access_group_sites 테이블
CREATE TABLE IF NOT EXISTS "site_access_group_sites" (
  "id"            TEXT         NOT NULL,
  "accessGroupId" TEXT         NOT NULL,
  "siteId"        TEXT         NOT NULL,
  "addedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "addedBy"       TEXT         NOT NULL,

  CONSTRAINT "site_access_group_sites_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "site_access_group_sites_accessGroupId_siteId_key"
    ON "site_access_group_sites"("accessGroupId", "siteId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "site_access_group_sites_siteId_idx"
    ON "site_access_group_sites"("siteId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. user_site_access_groups 테이블
CREATE TABLE IF NOT EXISTS "user_site_access_groups" (
  "id"            TEXT         NOT NULL,
  "userId"        TEXT         NOT NULL,
  "accessGroupId" TEXT         NOT NULL,
  "isActive"      BOOLEAN      NOT NULL DEFAULT true,
  "assignedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy"    TEXT         NOT NULL,
  "revokedAt"     TIMESTAMP(3),
  "revokedBy"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_site_access_groups_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "user_site_access_groups_userId_accessGroupId_key"
    ON "user_site_access_groups"("userId", "accessGroupId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "user_site_access_groups_userId_isActive_idx"
    ON "user_site_access_groups"("userId", "isActive");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "user_site_access_groups_accessGroupId_idx"
    ON "user_site_access_groups"("accessGroupId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Foreign Key: site_access_group_sites → site_access_groups
DO $$ BEGIN
  ALTER TABLE "site_access_group_sites"
    ADD CONSTRAINT "site_access_group_sites_accessGroupId_fkey"
    FOREIGN KEY ("accessGroupId")
    REFERENCES "site_access_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Foreign Key: site_access_group_sites → sites
DO $$ BEGIN
  ALTER TABLE "site_access_group_sites"
    ADD CONSTRAINT "site_access_group_sites_siteId_fkey"
    FOREIGN KEY ("siteId")
    REFERENCES "sites"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Foreign Key: user_site_access_groups → admin_users
DO $$ BEGIN
  ALTER TABLE "user_site_access_groups"
    ADD CONSTRAINT "user_site_access_groups_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "admin_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Foreign Key: user_site_access_groups → site_access_groups
DO $$ BEGIN
  ALTER TABLE "user_site_access_groups"
    ADD CONSTRAINT "user_site_access_groups_accessGroupId_fkey"
    FOREIGN KEY ("accessGroupId")
    REFERENCES "site_access_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
