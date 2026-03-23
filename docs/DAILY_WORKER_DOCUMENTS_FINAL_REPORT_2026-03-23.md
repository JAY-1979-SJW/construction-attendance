# 일용직 문서 기능 최종 마감 보고서

- 작성일: 2026-03-23
- 작성자: Claude (자동 검증 + 마감 보고)
- 상태: **운영 투입 가능**

---

## 1. 구현 완료 범위

### 문서 5종

| # | 문서명 | docType | 법적 근거 |
|---|--------|---------|-----------|
| 1 | 건설 일용근로자 근로계약서 | `generate-pdf` (DAILY_EMPLOYMENT) | 근로기준법 제17조 |
| 2 | 근로조건 설명 확인서 | `WORK_CONDITIONS_RECEIPT` | 근로기준법 제17조 |
| 3 | 개인정보 수집·이용 동의서 | `PRIVACY_CONSENT` | 개인정보 보호법 제15조 |
| 4 | 건설업 기초안전보건교육 확인서 | `BASIC_SAFETY_EDU_CONFIRM` | 산업안전보건법 제31조 |
| 5 | 현장 안전수칙 준수 확인서 | `SITE_SAFETY_RULES_CONFIRM` | 산업안전보건법 제38조·제39조 |

### 관련 API 엔드포인트

- `POST /api/admin/contracts` — 계약 생성·저장
- `POST /api/admin/contracts/[id]/generate-pdf` — 근로계약서(문서 1) 생성
- `POST /api/admin/contracts/[id]/generate-doc` — 부속문서(문서 2~5) 생성

---

## 2. 자동 채움 범위

### 회사 정보 (관리자가 회사 선택 시 자동 채움)
- `companyName` 회사명
- `companyPhone` 연락처
- `companyBizNo` 사업자등록번호
- `companyAddress` 주소
- `companyRepName` 대표자명

### 근로자 정보 (근로자 선택 시 자동 채움)
- `workerName` 성명 (worker 마스터 live 조회)
- `workerPhone` 연락처 (worker 마스터 live 조회)
- `workerBirthDate` 생년월일
- `workerBankName` 은행명
- `workerAccountNumber` 계좌번호
- `workerAccountHolder` 예금주 (기본값: 근로자 성명)

### 현장 정보 (현장 선택 시 자동 채움)
- `siteName` 현장명 (site 마스터 live 조회)
- `siteAddress` 현장 주소

---

## 3. 스냅샷 저장 범위

계약 생성 시점에 `worker_contracts` 테이블에 복사·저장되는 필드:

| 필드 | 설명 | 스냅샷 여부 |
|------|------|------------|
| companyName | 회사명 | ✓ 스냅샷 |
| companyPhone | 회사 연락처 | ✓ 스냅샷 |
| companyBizNo | 사업자등록번호 | ✓ 스냅샷 |
| companyAddress | 회사 주소 | ✓ 스냅샷 |
| companyRepName | 대표자명 | ✓ 스냅샷 |
| workerBirthDate | 근로자 생년월일 | ✓ 스냅샷 |
| workerAddress | 근로자 주소 | ✓ 스냅샷 |
| workerBankName | 은행명 | ✓ 스냅샷 |
| workerAccountNumber | 계좌번호 | ✓ 스냅샷 |
| workerAccountHolder | 예금주 | ✓ 스냅샷 |
| workDate | 근로일 | ✓ 스냅샷 |
| workerName | 근로자 성명 | ✗ live 조회 (worker 마스터) |
| workerPhone | 근로자 연락처 | ✗ live 조회 (worker 마스터) |
| siteName | 현장명 | ✗ live 조회 (site 마스터) |
| siteAddress (마스터) | 현장 주소 | ✗ live 조회 (site 마스터) — siteAddress 입력값은 스냅샷됨 |

> **주의**: workerName·workerPhone·siteName은 마스터 변경 시 기존 계약 PDF에도 반영됨. 계약 생성 전 마스터 정보를 먼저 확정해야 함.

---

## 4. PDF 생성 경로

```
관리자 계약 상세 화면
  └─ [근로계약서 생성] 버튼
       └─ POST /api/admin/contracts/[id]/generate-pdf
            ├─ worker_contracts 조회 (스냅샷 필드 사용)
            ├─ worker join (name, phone live)
            ├─ site join (name, address live)
            ├─ buildContractData() 조합
            ├─ contractTemplateType 기준 렌더 함수 선택
            │    └─ DAILY_EMPLOYMENT → renderDailyEmploymentContract()
            ├─ GeneratedDocument 저장 (DAILY_CONTRACT)
            └─ ContractVersion 스냅샷 저장

  └─ [부속문서 생성] (WORK_CONDITIONS_RECEIPT 등)
       └─ POST /api/admin/contracts/[id]/generate-doc
            ├─ contractToTemplateData() 조합 (v3.6 필드 포함)
            ├─ docType 기준 renderDoc() 디스패치
            │    ├─ WORK_CONDITIONS_RECEIPT → renderWorkConditionsReceipt()
            │    ├─ PRIVACY_CONSENT → renderPrivacyConsent()
            │    ├─ BASIC_SAFETY_EDU_CONFIRM → renderBasicSafetyEduConfirm()
            │    └─ SITE_SAFETY_RULES_CONFIRM → renderSiteSafetyRulesConfirm()
            └─ GeneratedDocument 저장
```

---

## 5. DB 반영 컬럼 / enum

### `worker_contracts` 테이블 신규 컬럼 (v3.6)
- `companyName TEXT`
- `companyPhone TEXT`
- `workerBankName TEXT`
- `workerAccountNumber TEXT`
- `workerAccountHolder TEXT`
- `workDate TEXT`
- `companyBizNo TEXT` (v3.5 이전)
- `companyAddress TEXT` (v3.5 이전)
- `companyRepName TEXT` (v3.5 이전)
- `workerBirthDate TEXT` (v3.5 이전)
- `workerAddress TEXT` (v3.5 이전)

### `SafetyDocumentType` enum 추가 (마이그레이션 run-migration-092000)
- `BASIC_SAFETY_EDU_CONFIRM`
- `SITE_SAFETY_RULES_CONFIRM`

### `GeneratedDocumentType` enum 추가 (마이그레이션 run-migration-092100)
- `WORK_CONDITIONS_RECEIPT`
- `PRIVACY_CONSENT`
- `BASIC_SAFETY_EDU_CONFIRM`
- `SITE_SAFETY_RULES_CONFIRM`

---

## 6. 위험 문구 제거 결과

검색 범위: `lib/contracts/templates.ts`, `lib/contracts/safety-docs.ts` 전체

| 검색어 | 결과 |
|--------|------|
| 계속근로 | CONTINUOUS_EMPLOYMENT 렌더러에만 존재 — 일용직 경로 없음 |
| 상시근로 | 0건 |
| 무기계약 | 0건 |
| 정규직 | 0건 |
| 상시고용 | 0건 |
| 고정월급 / 고정급 / 상시근무 | 0건 |

`MONTHLY_FIXED_EMPLOYMENT` / `CONTINUOUS_EMPLOYMENT` 레이블은 UI에서 `[관리자]` 접두어로만 표시되며 PDF 본문에 노출되지 않음.

---

## 7. E2E 검수 결과

테스트 환경: 서버 `1.201.176.236` / 컨테이너 `attendance`

### 문서 5종 생성 결과

| # | 문서명 | 상태코드 | 근로자명 | 현장명 | 근로일 | 금액 | 서명란 | 금지문구 |
|---|--------|---------|---------|-------|-------|------|--------|---------|
| 1 | 근로계약서 | 201 ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 0건 |
| 2 | 근로조건설명확인서 | 201 ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 0건 |
| 3 | 개인정보동의서 | 201 ✓ | ✓ | — | — | — | ✓ | 0건 |
| 4 | 기초안전보건교육확인서 | 201 ✓ | ✓ | ✓ | ✓ | — | ✓ | 0건 |
| 5 | 현장안전수칙준수확인서 | 201 ✓ | ✓ | ✓ | ✓ | — | ✓ | 0건 |

### 스냅샷 불변성 확인

companyPhone / workerBankName / workerAccountNumber / workDate — 저장 후 재조회 및 PDF 재생성 시 생성 시점 값 유지 확인.

---

## 8. 예외 처리 결과

| 케이스 | 응답 코드 | 메시지 | 500 여부 |
|--------|---------|--------|---------|
| workerId 누락 | 400 | "workerId, startDate... 필수" | 없음 |
| dailyWage 누락 | 400 | "근로계약에는 일당 또는 월급 필수" | 없음 |
| 잘못된 계약 ID | 404 | "계약 없음" | 없음 |
| 잘못된 docType | 400 | "지원하지 않는 docType: ..." | 없음 |
| 팀장형+직접관리 | 400 | "팀장형 계약을 사용할 수 없습니다..." | 없음 |

---

## 9. 수정 내역 (검증 중 발견·수정 4건)

| # | 파일 | 이유 | 결과 |
|---|------|------|------|
| 1 | `generate-doc/route.ts` | 신규 4종 import·switch 누락 | 수정 완료 |
| 2 | `lib/contracts/index.ts` | DOC_PACKAGES에 4종 미등록 | 수정 완료 |
| 3 | `generate-doc/route.ts` | contractToTemplateData v3.6 필드 누락 | 수정 완료 |
| 4 | `prisma/schema.prisma` + migration-092100 | GeneratedDocumentType enum에 4종 없어 런타임 오류 | 수정·배포 완료 |

---

## 10. 잔여 리스크

| 리스크 | 심각도 | 내용 |
|--------|--------|------|
| workerName · workerPhone 비스냅샷 | 경미 | 마스터 변경 시 기존 계약 PDF에도 반영됨. 일용직 특성상 실무 영향 낮음. 필요 시 다음 단계에서 스냅샷 범위 확장 가능 |
| 일용직 계약서에 projectName 미출력 | 경미 | 일용직 계약서는 workType/jobCategory 중심 설계, 현장명으로 대체됨 |
| generate-doc CONTRACT 타입이 MONTHLY_FIXED/CONTINUOUS 미지원 | 낮음 | 해당 유형은 generate-pdf 전용. 혼용 가능성을 운영 가이드로 차단 |

---

## 11. 최종 판정

> **일용직 문서 기능 — 운영 투입 가능**

**근거:**
- 문서 5종 생성 서버 E2E 전항목 통과
- 자동채움·스냅샷 저장 정상 확인
- 위험 문구 0건, 관리자 레이블 PDF 미노출
- 예외 처리 5종 전원 500 없이 안전 반환
- 코드·DB·배포 수정 4건 완료 및 재검증 통과
- 마이그레이션 2종(092000, 092100) 서버 적용 완료
