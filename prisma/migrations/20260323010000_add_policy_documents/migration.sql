-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'LOCATION_POLICY', 'MARKETING_NOTICE');

-- CreateTable policy_documents
CREATE TABLE IF NOT EXISTS "policy_documents" (
    "id" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "contentMd" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "policy_documents_documentType_isActive_idx" ON "policy_documents"("documentType", "isActive");
CREATE INDEX IF NOT EXISTS "policy_documents_effectiveFrom_idx" ON "policy_documents"("effectiveFrom");

-- AlterTable user_consents: policyDocumentId, documentVersion, isRequired, agreed 추가
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "policyDocumentId" TEXT;
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "documentVersion" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "agreed" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey user_consents -> policy_documents
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_policyDocumentId_fkey"
  FOREIGN KEY ("policyDocumentId") REFERENCES "policy_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "user_consents_policyDocumentId_idx" ON "user_consents"("policyDocumentId");

-- Seed: 초기 정책 문서 v1.0 (2026-03-23 시행)
INSERT INTO "policy_documents" ("id", "documentType", "title", "version", "effectiveFrom", "contentMd", "isActive", "isRequired", "createdAt", "updatedAt")
VALUES
(
  'pdoc_terms_v1',
  'TERMS_OF_SERVICE',
  '서비스 이용약관',
  '1.0',
  '2026-03-23 00:00:00',
  '## 서비스 이용약관

**시행일: 2026년 3월 23일**

### 제1조 (목적)
이 약관은 해한AI(이하 "회사")가 제공하는 건설현장 출퇴근 관리 서비스(이하 "서비스")의 이용에 관한 기본적인 사항을 규정함을 목적으로 합니다.

### 제2조 (용어 정의)
1. **서비스**: 회사가 제공하는 GPS 기반 출퇴근 기록 및 노무 관리 플랫폼
2. **이용자**: 서비스에 가입하여 이용하는 근로자 및 관리자
3. **현장**: 출퇴근이 기록되는 건설 공사 현장

### 제3조 (서비스 이용)
1. 서비스 이용을 위해서는 관리자의 계정 승인이 필요합니다.
2. 승인된 기기에서만 출퇴근 기록이 가능합니다.
3. 현장 참여 승인 후 해당 현장에서 출퇴근할 수 있습니다.

### 제4조 (이용자 의무)
1. 타인의 계정을 사용하거나 대리 출퇴근을 해서는 안 됩니다.
2. 허위 위치 정보를 사용해서는 안 됩니다.
3. 서비스 이용과 관련된 정보를 정확하게 입력해야 합니다.

### 제5조 (서비스 중단)
회사는 시스템 점검, 장애, 천재지변 등의 경우 서비스를 일시 중단할 수 있습니다.

### 제6조 (약관 변경)
회사는 약관을 변경할 경우 시행일 7일 전에 공지합니다.',
  true,
  true,
  NOW(),
  NOW()
),
(
  'pdoc_privacy_v1',
  'PRIVACY_POLICY',
  '개인정보 처리방침',
  '1.0',
  '2026-03-23 00:00:00',
  '## 개인정보 처리방침

**시행일: 2026년 3월 23일**

해한AI(이하 "회사")는 개인정보 보호법에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하게 처리합니다.

### 1. 수집하는 개인정보 항목

**필수 항목:**
- 이름, 휴대폰번호, 직종
- 위치정보 (출퇴근 기록 시)
- 기기정보 (기기 식별자)

**선택 항목:**
- 이메일, 아이디, 생년월일

### 2. 개인정보 수집 및 이용 목적
- 본인 확인 및 서비스 제공
- GPS 기반 출퇴근 기록 관리
- 노무 행정 처리 (4대보험, 퇴직공제 등)
- 근로계약 및 급여 처리

### 3. 개인정보 보유 및 이용 기간
- 회원 탈퇴 시까지 보유
- 법령에 따라 보존이 필요한 경우: 최대 5년
  - 근로계약 관련 서류: 3년 (근로기준법)
  - 소득세 관련 서류: 5년 (국세기본법)

### 4. 개인정보 제3자 제공
원칙적으로 개인정보를 제3자에게 제공하지 않습니다. 다만, 아래의 경우는 예외입니다.
- 이용자 동의가 있는 경우
- 법령에 의한 경우

### 5. 개인정보 처리 위탁
- AWS (서버 호스팅): 개인정보 저장 및 처리

### 6. 이용자의 권리
이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.

**개인정보 보호책임자:** 해한AI 대표',
  true,
  true,
  NOW(),
  NOW()
),
(
  'pdoc_location_v1',
  'LOCATION_POLICY',
  '위치정보 이용 동의',
  '1.0',
  '2026-03-23 00:00:00',
  '## 위치정보 이용 동의

**시행일: 2026년 3월 23일**

### 위치정보 수집 및 이용 목적
- GPS 기반 현장 출퇴근 기록
- 현장 반경 내 위치 확인
- 중간 체류 확인 (서비스 설정에 따라)

### 수집하는 위치정보
- GPS 좌표 (위도, 경도)
- 위치 정확도 (meters)
- 수집 시각

### 수집 시점
- 출근 버튼 클릭 시
- 퇴근 버튼 클릭 시
- 중간 체류 확인 요청 시 (활성화된 경우)

### 위치정보 보유 기간
- 출퇴근 기록과 함께 보관
- 퇴직 후 3년 (노무 행정 목적)

### 위치정보 서비스 사업자
해한AI는 위치정보의 보호 및 이용 등에 관한 법률에 따라 위치정보 서비스를 제공합니다.

이 동의를 거부하실 경우 출퇴근 기록 서비스를 이용하실 수 없습니다.',
  true,
  true,
  NOW(),
  NOW()
),
(
  'pdoc_marketing_v1',
  'MARKETING_NOTICE',
  '마케팅 정보 수신 동의 (선택)',
  '1.0',
  '2026-03-23 00:00:00',
  '## 마케팅 정보 수신 동의 (선택)

**시행일: 2026년 3월 23일**

### 수신 동의 항목
- 서비스 업데이트 및 신기능 안내
- 이벤트 및 혜택 정보

### 수신 방법
- SMS 문자메시지
- 앱 푸시 알림 (향후 지원 예정)

### 보유 기간
동의 철회 시까지

동의를 거부하셔도 기본 서비스 이용에는 불이익이 없습니다.',
  true,
  false,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;
