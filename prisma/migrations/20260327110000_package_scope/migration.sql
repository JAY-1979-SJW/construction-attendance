-- CreateEnum
CREATE TYPE "PackageScope" AS ENUM ('GLOBAL', 'SITE');

-- AlterTable: scope 컬럼 추가
ALTER TABLE "worker_document_packages" ADD COLUMN "scope" "PackageScope" NOT NULL DEFAULT 'GLOBAL';

-- 기존 데이터 보정: siteId가 있으면 SITE, 없으면 GLOBAL
UPDATE "worker_document_packages" SET "scope" = 'SITE' WHERE "siteId" IS NOT NULL;
UPDATE "worker_document_packages" SET "scope" = 'GLOBAL' WHERE "siteId" IS NULL;

-- 부분 유니크 인덱스: siteId IS NULL인 GLOBAL 패키지는 workerId당 1개만 허용
CREATE UNIQUE INDEX "worker_document_packages_worker_global_unique"
  ON "worker_document_packages" ("workerId")
  WHERE "siteId" IS NULL;
