-- Migration: 보험요율 버전 관리 + 임시 민감 서류

-- ─── Enums ───────────────────────────────────────────────

CREATE TYPE "InsuranceRateType" AS ENUM (
  'NATIONAL_PENSION',
  'HEALTH_INSURANCE',
  'LONG_TERM_CARE',
  'EMPLOYMENT_INSURANCE',
  'EMPLOYMENT_STABILITY',
  'INDUSTRIAL_ACCIDENT',
  'RETIREMENT_MUTUAL'
);

CREATE TYPE "InsuranceRateVersionStatus" AS ENUM (
  'DRAFT',
  'REVIEW_PENDING',
  'REVIEWED',
  'APPROVED_FOR_USE',
  'DEPRECATED'
);

CREATE TYPE "TempDocEventType" AS ENUM (
  'UPLOADED',
  'DOWNLOADED',
  'DELETED',
  'AUTO_DELETED',
  'EXPIRED'
);

-- ─── 보험요율 버전 ─────────────────────────────────────────

CREATE TABLE "insurance_rate_versions" (
  "id"                       TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rateType"                 "InsuranceRateType" NOT NULL,
  "effectiveYear"            INTEGER NOT NULL,
  "effectiveMonth"           INTEGER,
  "totalRatePct"             DECIMAL(6,4),
  "employeeRatePct"          DECIMAL(6,4),
  "employerRatePct"          DECIMAL(6,4),
  "rateNote"                 TEXT,
  "industryCode"             TEXT,
  "officialSourceName"       TEXT,
  "officialSourceUrl"        TEXT,
  "officialAnnouncementDate" TIMESTAMPTZ,
  "referenceDocumentNo"      TEXT,
  "status"                   "InsuranceRateVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewNote"               TEXT,
  "reviewedBy"               TEXT,
  "reviewedAt"               TIMESTAMPTZ,
  "approvedBy"               TEXT,
  "approvedAt"               TIMESTAMPTZ,
  "deprecatedAt"             TIMESTAMPTZ,
  "createdBy"                TEXT,
  "createdAt"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "insurance_rate_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "insurance_rate_versions_rateType_year_idx"
  ON "insurance_rate_versions" ("rateType", "effectiveYear");
CREATE INDEX "insurance_rate_versions_status_idx"
  ON "insurance_rate_versions" ("status");

-- ─── 보험요율 출처 모니터링 ───────────────────────────────

CREATE TABLE "insurance_rate_sources" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rateType"              "InsuranceRateType" NOT NULL,
  "sourceName"            TEXT NOT NULL,
  "sourceUrl"             TEXT NOT NULL,
  "checkFrequencyDays"    INTEGER NOT NULL DEFAULT 30,
  "lastCheckedAt"         TIMESTAMPTZ,
  "lastChangeDetectedAt"  TIMESTAMPTZ,
  "currentRateNote"       TEXT,
  "isActive"              BOOLEAN NOT NULL DEFAULT TRUE,
  "notes"                 TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "insurance_rate_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "insurance_rate_sources_rateType_key" UNIQUE ("rateType")
);

-- ─── 임시 민감 서류 ────────────────────────────────────────

CREATE TABLE "temp_sensitive_documents" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid(),
  "workerId"            TEXT NOT NULL,
  "documentType"        TEXT NOT NULL,
  "purpose"             TEXT NOT NULL,
  "fileName"            TEXT NOT NULL,
  "fileSize"            INTEGER NOT NULL,
  "mimeType"            TEXT NOT NULL,
  "filePath"            TEXT NOT NULL,
  "expiresAt"           TIMESTAMPTZ NOT NULL,
  "downloadedAt"        TIMESTAMPTZ,
  "deleteScheduledAt"   TIMESTAMPTZ,
  "deletedAt"           TIMESTAMPTZ,
  "deleteReason"        TEXT,
  "uploadedBy"          TEXT NOT NULL,
  "uploadedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "temp_sensitive_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "temp_sensitive_documents_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE
);

CREATE INDEX "temp_sensitive_documents_workerId_idx" ON "temp_sensitive_documents" ("workerId");
CREATE INDEX "temp_sensitive_documents_expiresAt_idx" ON "temp_sensitive_documents" ("expiresAt");
CREATE INDEX "temp_sensitive_documents_deleteScheduledAt_idx" ON "temp_sensitive_documents" ("deleteScheduledAt");

-- ─── 임시 서류 이벤트 로그 ────────────────────────────────

CREATE TABLE "temp_sensitive_document_events" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
  "documentId"   TEXT NOT NULL,
  "eventType"    "TempDocEventType" NOT NULL,
  "actorUserId"  TEXT,
  "actorType"    TEXT NOT NULL DEFAULT 'ADMIN',
  "reason"       TEXT,
  "ipAddress"    TEXT,
  "metadataJson" JSONB,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "temp_sensitive_document_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "temp_sensitive_document_events_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "temp_sensitive_documents"("id") ON DELETE CASCADE
);

CREATE INDEX "temp_sensitive_document_events_documentId_idx" ON "temp_sensitive_document_events" ("documentId");
CREATE INDEX "temp_sensitive_document_events_createdAt_idx" ON "temp_sensitive_document_events" ("createdAt");

-- ─── 2026 보험요율 기초 데이터 ───────────────────────────

-- 국민연금 2026 (9.5% 총, 근로자 4.75% + 사업주 4.75%)
INSERT INTO "insurance_rate_versions"
  ("id","rateType","effectiveYear","totalRatePct","employeeRatePct","employerRatePct",
   "officialSourceName","officialAnnouncementDate","referenceDocumentNo","rateNote",
   "status","approvedAt","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'NATIONAL_PENSION',2026,9.5000,4.7500,4.7500,
   '보건복지부','2025-09-01 00:00:00+00','보건복지부 고시 2025-154호',
   '국민연금법 개정에 따른 단계적 인상: 2026년 9.5%, 이후 매년 0.5%p 인상 예정',
   'APPROVED_FOR_USE',NOW(),NOW(),NOW());

-- 건강보험 2026 (7.09% 총 — 단, 보험료율위원회 의결 기준)
-- ※ 2026년 건강보험료율은 2025-08-28 보건복지부 고시 기준 7.09% (전년 대비 동결)
-- ※ 장기요양보험료율은 건강보험료의 12.95% (별도 항목)
INSERT INTO "insurance_rate_versions"
  ("id","rateType","effectiveYear","totalRatePct","employeeRatePct","employerRatePct",
   "officialSourceName","officialAnnouncementDate","referenceDocumentNo","rateNote",
   "status","approvedAt","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'HEALTH_INSURANCE',2026,7.0900,3.5450,3.5450,
   '보건복지부','2025-08-28 00:00:00+00','보건복지부 고시 2025-228호',
   '2026년 건강보험료율 7.09% (전년 동결). 세무사 또는 공단 확인 후 최종 적용 요망.',
   'APPROVED_FOR_USE',NOW(),NOW(),NOW());

-- 장기요양보험 2026 (건강보험료의 12.95%)
INSERT INTO "insurance_rate_versions"
  ("id","rateType","effectiveYear","totalRatePct","employeeRatePct","employerRatePct",
   "officialSourceName","officialAnnouncementDate","referenceDocumentNo","rateNote",
   "status","approvedAt","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'LONG_TERM_CARE',2026,0.9188,0.4594,0.4594,
   '보건복지부','2025-11-04 00:00:00+00','보건복지부 고시 2025-334호',
   '장기요양보험료 = 건강보험료의 12.95%. 표시 요율은 보수총액 기준 환산 참고치.',
   'APPROVED_FOR_USE',NOW(),NOW(),NOW());

-- 고용보험 실업급여 2026 (총 1.8%, 근로자 0.9%, 사업주 0.9%)
INSERT INTO "insurance_rate_versions"
  ("id","rateType","effectiveYear","totalRatePct","employeeRatePct","employerRatePct",
   "officialSourceName","officialAnnouncementDate","referenceDocumentNo","rateNote",
   "status","approvedAt","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'EMPLOYMENT_INSURANCE',2026,1.8000,0.9000,0.9000,
   '고용노동부','2025-12-31 00:00:00+00','고용노동부 고시 2025-87호',
   '실업급여 보험요율. 일용근로자는 근로자·사업주 각 0.9% 부담.',
   'APPROVED_FOR_USE',NOW(),NOW(),NOW());

-- 고용안정·직업능력개발 2026 (사업주만, 규모별 차등)
INSERT INTO "insurance_rate_versions"
  ("id","rateType","effectiveYear","totalRatePct","employeeRatePct","employerRatePct",
   "officialSourceName","officialAnnouncementDate","referenceDocumentNo","rateNote",
   "status","approvedAt","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'EMPLOYMENT_STABILITY',2026,0.2500,0.0000,0.2500,
   '고용노동부','2025-12-31 00:00:00+00','고용노동부 고시 2025-87호',
   '사업주만 부담. 150인 미만 0.25%, 150인 이상~1000인 미만 0.45%, 1000인 이상 0.65% (우선지원대상기업 0.25%). 실제 규모 확인 후 적용.',
   'APPROVED_FOR_USE',NOW(),NOW(),NOW());

-- 산재보험 건설업 2026 (건설업 일반: 3.7%)
INSERT INTO "insurance_rate_versions"
  ("id","rateType","effectiveYear","totalRatePct","employeeRatePct","employerRatePct",
   "officialSourceName","officialAnnouncementDate","referenceDocumentNo","rateNote",
   "industryCode","status","approvedAt","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'INDUSTRIAL_ACCIDENT',2026,3.7000,0.0000,3.7000,
   '고용노동부','2025-12-31 00:00:00+00','고용노동부 고시 2025-88호',
   '건설업 산재보험료율 3.7% (사업주 전액 부담). 업종 분류 코드 47. 실제 적용 시 세무사/근로복지공단 확인 필요.',
   '47','APPROVED_FOR_USE',NOW(),NOW(),NOW());

-- ─── 출처 모니터링 초기 데이터 ────────────────────────────

INSERT INTO "insurance_rate_sources"
  ("id","rateType","sourceName","sourceUrl","checkFrequencyDays","currentRateNote","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'NATIONAL_PENSION','국민연금공단',
   'https://www.nps.or.kr/jsppage/info/resources/contribution_rate.jsp',
   90,'2026년: 총 9.5% (근로자 4.75%, 사업주 4.75%)',NOW(),NOW()),
  (gen_random_uuid(),'HEALTH_INSURANCE','국민건강보험공단',
   'https://www.nhis.or.kr/nhis/policy/wbhaca02000m01.do',
   90,'2026년: 총 7.09% (근로자 3.545%, 사업주 3.545%)',NOW(),NOW()),
  (gen_random_uuid(),'LONG_TERM_CARE','국민건강보험공단',
   'https://www.nhis.or.kr/nhis/policy/wbhacb02000m01.do',
   90,'2026년: 건강보험료의 12.95%',NOW(),NOW()),
  (gen_random_uuid(),'EMPLOYMENT_INSURANCE','고용노동부',
   'https://www.moel.go.kr/info/lawinfo/instruction/view.do',
   180,'2026년 실업급여: 총 1.8% (근로자·사업주 각 0.9%)',NOW(),NOW()),
  (gen_random_uuid(),'EMPLOYMENT_STABILITY','고용노동부',
   'https://www.moel.go.kr/info/lawinfo/instruction/view.do',
   180,'2026년: 사업주 규모별 0.25%~0.65%',NOW(),NOW()),
  (gen_random_uuid(),'INDUSTRIAL_ACCIDENT','근로복지공단',
   'https://www.comwel.or.kr/comwel/paym/coobusi/rate.jsp',
   180,'2026년 건설업: 3.7% (사업주 전액 부담)',NOW(),NOW()),
  (gen_random_uuid(),'RETIREMENT_MUTUAL','건설근로자공제회',
   'https://www.cwma.or.kr/retire/employer/enroll',
   365,'건설일용근로자 퇴직공제: 근로일당 납부금액 고시 기준',NOW(),NOW());
