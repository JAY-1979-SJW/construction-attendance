-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 민감 개인정보 분리보관 테이블 추가
-- 정책: 신분증 파일 미저장, AES-256-GCM 암호화, HMAC 해시 검색
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateEnum: 신분증 확인 방식
DO $$ BEGIN
  CREATE TYPE "IdVerificationMethod" AS ENUM ('IN_PERSON', 'SECURE_DOCUMENT', 'ADMIN_MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: 노무/보험 준비 상태
DO $$ BEGIN
  CREATE TYPE "ComplianceReadyStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'EXEMPT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── worker_sensitive_profiles ─────────────────────────────────────────────
-- 주민등록번호·휴대폰·주소 암호화 저장
-- 신분증 파일은 저장하지 않음 (확인 결과만 기록)
CREATE TABLE IF NOT EXISTS "worker_sensitive_profiles" (
    "id"                    TEXT        NOT NULL,
    "workerId"              TEXT        NOT NULL,
    "legalName"             TEXT,

    -- 주민등록번호
    "rrnEncrypted"          TEXT,        -- AES-256-GCM
    "rrnMasked"             TEXT,        -- "800101-1******"
    "rrnHash"               TEXT,        -- HMAC-SHA256

    -- 휴대폰번호 원문
    "phoneEncrypted"        TEXT,        -- AES-256-GCM
    "phoneMasked"           TEXT,        -- "010-12**-5678"
    "phoneHash"             TEXT,        -- HMAC-SHA256

    -- 주소
    "addressEncrypted"      TEXT,        -- AES-256-GCM
    "addressMasked"         TEXT,        -- "서울 강남구 ***"

    -- 신분증 확인 결과 (파일 없음)
    "idVerified"            BOOLEAN     NOT NULL DEFAULT false,
    "idDocumentType"        TEXT,
    "idVerificationMethod"  "IdVerificationMethod",
    "idVerifiedBy"          TEXT,
    "idVerifiedAt"          TIMESTAMP(3),
    "idVerificationNote"    TEXT,

    -- 수집 이력
    "collectedBy"           TEXT,
    "collectedAt"           TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_sensitive_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "worker_sensitive_profiles_workerId_key"
  ON "worker_sensitive_profiles"("workerId");

CREATE INDEX IF NOT EXISTS "worker_sensitive_profiles_rrnHash_idx"
  ON "worker_sensitive_profiles"("rrnHash");

CREATE INDEX IF NOT EXISTS "worker_sensitive_profiles_phoneHash_idx"
  ON "worker_sensitive_profiles"("phoneHash");

ALTER TABLE "worker_sensitive_profiles"
  ADD CONSTRAINT "worker_sensitive_profiles_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── worker_bank_accounts_secure ──────────────────────────────────────────
-- 계좌번호 암호화 저장
CREATE TABLE IF NOT EXISTS "worker_bank_accounts_secure" (
    "id"                         TEXT        NOT NULL,
    "workerId"                   TEXT        NOT NULL,
    "bankCode"                   TEXT,
    "bankName"                   TEXT,
    "accountNumberEncrypted"     TEXT,        -- AES-256-GCM
    "accountNumberMasked"        TEXT,        -- "****5678"
    "accountNumberHash"          TEXT,        -- HMAC-SHA256
    "accountHolderNameEncrypted" TEXT,        -- AES-256-GCM
    "accountHolderNameMasked"    TEXT,
    "verifiedBy"                 TEXT,
    "verifiedAt"                 TIMESTAMP(3),
    "collectedBy"                TEXT,
    "collectedAt"                TIMESTAMP(3),
    "createdAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_bank_accounts_secure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "worker_bank_accounts_secure_workerId_key"
  ON "worker_bank_accounts_secure"("workerId");

ALTER TABLE "worker_bank_accounts_secure"
  ADD CONSTRAINT "worker_bank_accounts_secure_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── worker_compliance_statuses ───────────────────────────────────────────
-- 출퇴근 상태와 별도인 노무/4대보험 준비 상태
CREATE TABLE IF NOT EXISTS "worker_compliance_statuses" (
    "id"                        TEXT                    NOT NULL,
    "workerId"                  TEXT                    NOT NULL,
    "basicIdentityChecked"      BOOLEAN                 NOT NULL DEFAULT false,
    "rrnCollected"              BOOLEAN                 NOT NULL DEFAULT false,
    "addressCollected"          BOOLEAN                 NOT NULL DEFAULT false,
    "bankInfoCollected"         BOOLEAN                 NOT NULL DEFAULT false,
    "nationalPensionStatus"     "ComplianceReadyStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "healthInsuranceStatus"     "ComplianceReadyStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "employmentInsuranceStatus" "ComplianceReadyStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "industrialAccidentStatus"  "ComplianceReadyStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "retirementMutualStatus"    "ComplianceReadyStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes"                     TEXT,
    "updatedBy"                 TEXT,
    "updatedAt"                 TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"                 TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_compliance_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "worker_compliance_statuses_workerId_key"
  ON "worker_compliance_statuses"("workerId");

ALTER TABLE "worker_compliance_statuses"
  ADD CONSTRAINT "worker_compliance_statuses_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
