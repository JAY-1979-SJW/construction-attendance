-- 앱 공통 문서 동의 시스템 마이그레이션
-- ConsentDoc (consent_docs) + WorkerDocConsent (worker_doc_consents)

CREATE TYPE "ConsentDocType" AS ENUM (
  'SAFETY_PLEDGE',
  'PRIVACY_CONSENT',
  'SITE_NOTICE',
  'TBM_CONFIRMATION',
  'LABOR_CONTRACT',
  'GENERAL'
);

CREATE TYPE "ConsentDocScope" AS ENUM (
  'GLOBAL',
  'COMPANY',
  'SITE'
);

CREATE TABLE "consent_docs" (
  "id"          TEXT NOT NULL,
  "docType"     "ConsentDocType" NOT NULL,
  "scope"       "ConsentDocScope" NOT NULL DEFAULT 'GLOBAL',
  "companyId"   TEXT,
  "siteId"      TEXT,
  "title"       TEXT NOT NULL,
  "contentMd"   TEXT NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "isRequired"  BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "consent_docs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "consent_docs_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "consent_docs_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "consent_docs_scope_isActive_idx" ON "consent_docs"("scope", "isActive");
CREATE INDEX "consent_docs_companyId_idx"        ON "consent_docs"("companyId");
CREATE INDEX "consent_docs_siteId_idx"           ON "consent_docs"("siteId");

CREATE TABLE "worker_doc_consents" (
  "id"           TEXT NOT NULL,
  "workerId"     TEXT NOT NULL,
  "consentDocId" TEXT NOT NULL,
  "agreedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "worker_doc_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "worker_doc_consents_workerId_consentDocId_key"
    UNIQUE ("workerId", "consentDocId"),
  CONSTRAINT "worker_doc_consents_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "worker_doc_consents_consentDocId_fkey"
    FOREIGN KEY ("consentDocId") REFERENCES "consent_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "worker_doc_consents_workerId_idx" ON "worker_doc_consents"("workerId");

-- 기본 전역 문서 2건 삽입: 개인정보 동의서 + 안전교육 서약서
INSERT INTO "consent_docs" ("id", "docType", "scope", "title", "contentMd", "isActive", "isRequired", "sortOrder", "updatedAt")
VALUES
  (
    'global-privacy-consent-v1',
    'PRIVACY_CONSENT',
    'GLOBAL',
    '개인정보 수집·이용 동의서',
    E'## 개인정보 수집·이용 동의서\n\n본 서비스는 근로계약 이행 및 출퇴근 관리를 위해 아래와 같이 개인정보를 수집·이용합니다.\n\n### 수집 항목\n- 성명, 생년월일, 연락처\n- 출퇴근 기록, 위치정보\n- 임금 지급 관련 정보\n\n### 이용 목적\n- 근로계약 이행 및 급여 처리\n- 출퇴근 관리 및 현장 안전 관리\n\n### 보유 기간\n- 근로계약 종료 후 3년 (노동관계법령 기준)\n\n위 사항에 동의하며, 서비스를 이용합니다.',
    true,
    true,
    1,
    CURRENT_TIMESTAMP
  ),
  (
    'global-safety-pledge-v1',
    'SAFETY_PLEDGE',
    'GLOBAL',
    '안전교육 이수 및 서약서',
    E'## 안전교육 이수 및 서약서\n\n본인은 현장 투입 전 안전교육을 이수하였으며, 아래 사항을 성실히 준수할 것을 서약합니다.\n\n### 준수 사항\n1. 개인보호구(안전모, 안전화, 안전벨트 등) 착용 의무화\n2. 작업 전 위험요소 확인 및 보고\n3. 음주·약물 상태 작업 절대 금지\n4. 동료 근로자 안전 위협 행위 금지\n5. 안전관리자 지시에 즉각 따를 것\n\n### 위반 시 조치\n- 경고 및 현장 퇴출 조치\n- 산업재해 발생 시 귀책 사유에 따른 민·형사 책임\n\n본인은 위 안전교육 내용을 충분히 이해하였으며, 현장 안전수칙을 준수할 것을 서약합니다.',
    true,
    true,
    2,
    CURRENT_TIMESTAMP
  );
