-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'DELETED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE';
