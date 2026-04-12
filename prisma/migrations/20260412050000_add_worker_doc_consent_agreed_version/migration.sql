-- Migration: worker_doc_consents.agreed_version 추가
-- 목적: 문서 버전 변경 시 재동의 판정을 위한 동의 시점 버전 기록
--
-- 전략:
--   1. agreed_version 컬럼 추가 (DEFAULT 1 — 임시, 기존 레코드 INSERT 허용)
--   2. 기존 레코드를 consent_docs.version 값 기준으로 UPDATE (정확한 버전 반영)
-- 현재 DB 상태: consent_docs 5건 모두 version=1, worker_doc_consents 2건
-- → 기존 동의자 agreedVersion=1로 채워져 재동의 강제 없음

-- Step 1: 컬럼 추가
ALTER TABLE "worker_doc_consents"
ADD COLUMN "agreed_version" INTEGER NOT NULL DEFAULT 1;

-- Step 2: 기존 레코드를 실제 consent_docs.version으로 채움
-- 주의: Prisma 기본 매핑으로 컬럼명이 camelCase("consentDocId")로 유지됨
UPDATE "worker_doc_consents" wdc
SET "agreed_version" = cd."version"
FROM "consent_docs" cd
WHERE cd."id" = wdc."consentDocId";
