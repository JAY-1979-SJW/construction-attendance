# 상용직/계속근로자 문서 체계 — 구현 범위 제안서

- 작성일: 2026-03-23
- 기준: 일용직 기능 보존 + 상용직 최소 골격 분리

---

## 1. 이번 단계에서 반영 가능한 최소 범위

### 1-1. lib/contracts/index.ts

**추가할 것:**
- `REGULAR_EMPLOYEE` DOC_PACKAGES 정의
- `getDocPackageForTemplate(templateType)` 함수 추가

**수정하지 않을 것:**
- 기존 `DIRECT_EMPLOYEE` 패키지 — 일용직 그대로 유지

예시:
```typescript
REGULAR_EMPLOYEE: [
  { type: 'CONTRACT',                    label: '근로계약서',                   required: true },
  { type: 'WORK_CONDITIONS_RECEIPT',     label: '근로조건 설명 확인서',         required: true },
  { type: 'PRIVACY_CONSENT',             label: '개인정보 수집·이용 동의서',    required: true },
  { type: 'BASIC_SAFETY_EDU_CONFIRM',    label: '건설업 기초안전보건교육 확인서', required: true },
  { type: 'SITE_SAFETY_RULES_CONFIRM',   label: '현장 안전수칙 준수 확인서',    required: true },
  { type: 'SITE_ASSIGNMENT',             label: '현장배치 확인서',              required: false },
  { type: 'SAFETY_EDUCATION_NEW_HIRE',   label: '신규채용 안전보건교육 확인서', required: false },
  { type: 'PPE_PROVISION',               label: '보호구 지급 확인서',           required: false },
]
```

### 1-2. app/admin/contracts/new/page.tsx

**추가할 것 (일용직 영향 없음):**
- `isDailyType` 조건에 따른 입력 섹션 레이블 개선
- 상용직 선택 시 기본급 필드 강조, 월급 입력 UI 개선
- 상용직 선택 시 4대보험 기본값 전체 ON으로 자동 설정

**수정하지 않을 것:**
- 일용직 필드(workDate, dailyWage, 공수기준, 우천처리)는 현재 구조 유지

### 1-3. generate-doc 라우트

**추가할 것:**
- WORK_CONDITIONS_RECEIPT 케이스에 상용직 분기 주석 추가 (실제 함수는 다음 단계)

---

## 2. 다음 구현 단계 순서 (이번 단계 이후)

### Step 1. enum/타입 정리 (1~2시간)

- `ContractTemplateType`에 내용 정리 (현재 충분)
- DOC_PACKAGES에 `REGULAR_EMPLOYEE` 패키지 추가
- `getDocPackageForTemplate` 함수 구현

**파일:** `lib/contracts/index.ts`

---

### Step 2. UI 입력 폼 분기 정리 (2~4시간)

- `new/page.tsx`에서 `isDailyType` → `templateCategory` 방식으로 명확화
- 상용직 전용 섹션 컴포넌트 분리 또는 조건부 렌더링 추가
- 4대보험 기본값 자동 설정 분기

**파일:** `app/admin/contracts/new/page.tsx`

**일용직 영향:** 없음 (조건부 렌더링으로 기존 동작 유지)

---

### Step 3. Validation 추가 (1시간)

- 상용직 계약에 기본급 필수 validation 추가
- 기간제 계약에 endDate 필수 validation 추가

**파일:** `app/api/admin/contracts/route.ts`

**일용직 영향:** 없음 (기존 validation 유지, 추가만)

---

### Step 4. 근로조건 설명 확인서 상용직 버전 작성 (2~3시간)

- `renderWorkConditionsReceiptRegular` 함수 작성
  - workDate 대신 startDate/endDate 사용
  - 기본급 + 수당 구조 표시
  - 주소정근로시간 표시
  - 연차 적용 여부 표시
- generate-doc에 분기 추가

**파일:** `lib/contracts/safety-docs.ts`, `app/api/admin/contracts/[id]/generate-doc/route.ts`

**일용직 영향:** 없음 (기존 `renderWorkConditionsReceipt` 유지, 분기 추가)

---

### Step 5. 계약 상세 화면 문서 목록 분기 (1~2시간)

- 계약 상세 화면에서 현재 계약의 templateType에 따라 사용 가능한 문서 목록을 `getDocPackageForTemplate`로 결정
- 상용직 계약에 일용직 workDate 버전 문서가 생성되지 않도록 안내

**파일:** `app/admin/contracts/[id]/page.tsx`

---

### Step 6. E2E 검수 (상용직)

- 상용직 계약 생성 → PDF 생성 → 부속문서 생성 전체 흐름 검수
- 일용직 기존 기능 영향 없음 확인

---

### Step 7. 문서화

- 상용직 운영 체크리스트
- 상용직 관리자 화면 가이드

---

## 3. 이번 단계에서 하지 않을 것

| 항목 | 이유 |
|------|------|
| DB 컬럼 대량 추가 | worker_contracts 기존 컬럼으로 충분. 추가 불필요 |
| 상용직 문안 법적 확정 | 운영 검토 후 확정. 현재 renderRegularEmploymentContract 사용 |
| 기존 일용직 로직 리팩토링 | 마감 완료된 기능 건드리지 않음 |
| OFFICE_SERVICE / FREELANCER_SERVICE 구현 | 추후 별도 단계 |
| 외주팀 서류 분리 | 별도 단계 |

---

## 4. 일용직 영향 범위 확인 기준

상용직 구현 중 아래 파일 수정 시 일용직 영향 여부를 반드시 확인:

| 파일 | 확인 항목 |
|------|-----------|
| `lib/contracts/templates.ts` | renderDailyEmploymentContract 동작 변경 없음 |
| `lib/contracts/safety-docs.ts` | renderWorkConditionsReceipt 동작 변경 없음 |
| `lib/contracts/index.ts` | DIRECT_EMPLOYEE 패키지 변경 없음 |
| `generate-doc/route.ts` | 일용직 docType switch 케이스 변경 없음 |
| `generate-pdf/route.ts` | DAILY_EMPLOYMENT default 분기 변경 없음 |
| `new/page.tsx` | 일용직 자동채움 핸들러 변경 없음 |

---

## 5. 최종 판정

> **설계 완료, 다음 구현 단계 착수 가능**

- DB 추가 컬럼 없이 상용직 계약 저장·출력 가능 (기존 컬럼 재활용)
- 기존 렌더러(renderRegularEmploymentContract, renderContinuousContract)는 이미 구현 완료
- 분리 포인트가 명확함 (DOC_PACKAGES 분리, UI 섹션 분기, validation 분기)
- 일용직 기존 기능에 영향 없이 점진적 추가 가능
