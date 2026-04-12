-- AlterTable: consent_docs에 version 컬럼 추가
ALTER TABLE "consent_docs" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
