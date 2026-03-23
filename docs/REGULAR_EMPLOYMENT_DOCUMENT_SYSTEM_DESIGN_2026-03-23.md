# 상용직/계속근로자 문서 체계 분리 설계서

- 작성일: 2026-03-23
- 상태: 설계안 (구현 전)
- 전제: 일용직 문서 기능 기존 동작 보존

---

## 1. 근로형태 분류 체계 정의

### 1-1. 권장 분류 체계

| internal_type | admin_label | printable_document_family | 설명 |
|---------------|-------------|--------------------------|------|
| `DAILY_EMPLOYMENT` | 건설 일용근로계약서 (기본) | `DAILY_WORKER` | 1일 단위, 일당 기준. 현재 완성 |
| `MONTHLY_FIXED_EMPLOYMENT` | [관리자] 월단위 기간제 계약서 | `DAILY_WORKER` | 월단위 갱신형 일용직 유사. 일용직 패키지 공용 가능 |
| `REGULAR_EMPLOYMENT` | 상용직 근로계약서 (무기) | `REGULAR_WORKER` | 기간 정함 없는 상시고용 |
| `FIXED_TERM_EMPLOYMENT` | 기간제 근로계약서 | `REGULAR_WORKER` | 계약기간 있는 상용직 |
| `CONTINUOUS_EMPLOYMENT` | [관리자] 계속근로형 계약서 | `REGULAR_WORKER` | 무기계약 변형. 상용직 패키지 공용 가능 |

> **설계 원칙**: 내부 코드값(enum)은 현재 그대로 유지. 문서 패밀리(DOC_PACKAGES)만 분리.

### 1-2. 문서 패밀리 매핑 함수

```typescript
// lib/contracts/index.ts에 추가 예정
export function getDocPackageForTemplate(templateType: string): DocPackageKey {
  switch (templateType) {
    case 'REGULAR_EMPLOYMENT':
    case 'FIXED_TERM_EMPLOYMENT':
    case 'CONTINUOUS_EMPLOYMENT':
      return 'REGULAR_EMPLOYEE'
    case 'SUBCONTRACT_WITH_BIZ':
    case 'FREELANCER_SERVICE':
      return 'SUBCONTRACT_BIZ'
    case 'NONBUSINESS_TEAM_REVIEW':
      return 'TEAM_NONBIZ_REVIEW'
    default:
      return 'DIRECT_EMPLOYEE'  // 일용직 기본 유지
  }
}
```

---

## 2. 문서 패키지 분리안

### 2-1. DIRECT_EMPLOYEE (일용직) — 현재 완성

```
필수:
  CONTRACT               근로계약서
  WORK_CONDITIONS_RECEIPT 근로조건 설명 확인서 (workDate 기준)
  PRIVACY_CONSENT        개인정보 수집·이용 동의서
  BASIC_SAFETY_EDU_CONFIRM 기초안전보건교육 확인서
  SITE_SAFETY_RULES_CONFIRM 현장 안전수칙 준수 확인서
선택:
  SAFETY_EDUCATION_NEW_HIRE
  PPE_PROVISION
  SAFETY_PLEDGE
```

### 2-2. REGULAR_EMPLOYEE (상용직/기간제) — 신규 정의 필요

```
필수:
  CONTRACT               근로계약서 (상용직/기간제)
  WORK_CONDITIONS_RECEIPT_REGULAR  근로조건 설명 확인서 (상용직 버전, startDate 기준)
  PRIVACY_CONSENT        개인정보 수집·이용 동의서 (공통, 재사용)
  BASIC_SAFETY_EDU_CONFIRM         기초안전보건교육 확인서 (공통, 재사용)
  SITE_SAFETY_RULES_CONFIRM        현장 안전수칙 준수 확인서 (공통, 재사용)
선택:
  SAFETY_EDUCATION_NEW_HIRE
  PPE_PROVISION
  SAFETY_PLEDGE
  SITE_ASSIGNMENT        현장배치 확인서 (상용직 이직 시)
```

> **핵심 차이**: `WORK_CONDITIONS_RECEIPT_REGULAR`는 `workDate` 대신 `startDate`, 계약기간, 기본급 구조를 출력.

---

## 3. 데이터 모델 분리안

### 3-1. 필수 최소 컬럼 (이미 worker_contracts에 존재)

상용직 계약 저장에 추가 DB 컬럼 불필요. 이미 존재하는 컬럼으로 처리 가능:

| 컬럼 | 타입 | 일용직 사용 | 상용직 사용 |
|------|------|------------|------------|
| `startDate` | String | workDate로 대체 | 계약 시작일 필수 |
| `endDate` | String? | 사용 안 함 | 기간제 필수 |
| `monthlySalary` | Int? | 사용 안 함 | 기본급 필수 |
| `dailyWage` | Int | 필수 | 0 또는 null |
| `weeklyWorkDays` | Int? | 선택 | 소정근로일 필수 |
| `weeklyWorkHours` | Decimal? | 선택 | 소정근로시간 필수 |
| `probationYn` | Boolean | false | 시용기간 여부 |
| `probationMonths` | Int? | null | 시용기간 개월 수 |
| `annualLeaveRule` | String? | null | 연차 적용 문구 |
| `allowanceJson` | Json? | null | 수당 항목 |
| `paymentDay` | Int? | 말일 | 급여일 필수 |
| `nationalPensionYn` | Boolean | false | true 권장 |
| `healthInsuranceYn` | Boolean | false | true 권장 |
| `employmentInsuranceYn` | Boolean | false | true 권장 |

### 3-2. 추후 확장 컬럼 (현재 없음, 필요 시 추가)

| 컬럼명 제안 | 타입 | 설명 | 시급성 |
|------------|------|------|--------|
| `retirementBenefitYn` | Boolean | 퇴직금 적용 여부 (retirementMutualYn과 구분) | 중 |
| `fixedOvertimeYn` | Boolean | 포괄임금제 여부 | 낮음 |
| `fixedOvertimeHours` | Int? | 포함 연장근로시간 | 낮음 |
| `transferabilityYn` | Boolean | 근무지 변경 가능 여부 | 낮음 |

> **현 단계에서는 추후 확장 컬럼 추가 불필요.** 이미 존재하는 컬럼으로 상용직 계약서 출력 가능.

---

## 4. UI 입력 폼 분기 설계

### 4-1. 방식 비교

#### 방식 A — 한 화면에서 계약 유형 선택 후 동적 폼 분기 (현재 방식)

**장점:** 화면 전환 없음, 코드 집중, 기존 코드 재활용 최대화

**단점:**
- 일용직/상용직 입력 항목이 매우 달라 한 화면에 모두 담으면 복잡해짐
- `isDailyType` 조건문이 계속 늘어나 유지보수 어려워짐
- 현재 상태에서 상용직 섹션을 추가하면 폼이 매우 길어짐

#### 방식 B — 계약 유형별 별도 생성 페이지

**장점:** 각 유형에 최적화된 UI, 분기 조건 없이 깔끔, 확장 용이

**단점:**
- 페이지 파일 추가 필요 (`/admin/contracts/new-regular`)
- 공통 로직 중복 가능성 (회사/근로자/현장 자동채움 등)

#### 방식 C — 공통 베이스 + 상세 섹션 분리 컴포넌트 (권장)

**장점:**
- 공통 부분(회사선택, 근로자선택, 현장선택, 보험)은 공통 컴포넌트로 분리
- 일용직 전용 섹션 / 상용직 전용 섹션을 별도 컴포넌트로 관리
- 새 근로형태 추가 시 섹션 컴포넌트만 추가

**단점:** 초기 컴포넌트 분리 작업 필요

---

**권장: 방식 C** — 현재 `new/page.tsx`를 점진적으로 리팩토링.
- 1단계: 공통 섹션을 `ContractBaseSection` 컴포넌트로 분리
- 2단계: 일용직 전용 섹션 `DailyContractSection`, 상용직 전용 섹션 `RegularContractSection`을 별도로 구성
- 기존 일용직 기능은 그대로 유지하면서 상용직 섹션만 추가

### 4-2. 공통 / 전용 섹션 분리안

**공통 (근로형태 무관)**
- 계약 유형 분류 선택
- 계약서 유형 선택
- 회사 선택 + 자동채움
- 근로자 선택 + 자동채움
- 현장 선택 + 자동채움
- 4대보험 체크박스
- 특약사항

**일용직 전용**
- 근로일 (workDate) — 일용직의 핵심 필드
- 일당 입력
- 공종/직종
- 공수 기준 / 우천 처리 기준
- 출퇴근 인증 방식

**상용직/기간제 전용**
- 계약기간 (startDate + endDate) — 기간제 필수
- 기본급 (monthlySalary)
- 수당 항목 (allowanceJson)
- 시용기간 (probationYn, probationMonths)
- 주 소정근로일/시간
- 연차유급휴가 적용 방식
- 급여일
- 4대보험 기본값: 전체 ON

---

## 5. Validation / 저장 / PDF 분기 설계

### 5-1. Validation 분기

```typescript
// 일용직 validation (현재 유지)
if (contractKind === 'EMPLOYMENT' && !dailyWage && !monthlySalary) {
  return error('근로계약에는 일당 또는 월급 필수')
}

// 상용직 추가 validation (추가 예정)
if (['REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT'].includes(contractTemplateType)) {
  if (!monthlySalary) return error('상용직 근로계약에는 기본급 필수')
  if (contractTemplateType === 'FIXED_TERM_EMPLOYMENT' && !endDate) {
    return error('기간제 근로계약에는 계약 종료일 필수')
  }
}
```

### 5-2. buildContractData 분기 구조

현재 `buildContractData`는 단일 함수. 상용직 추가 시 두 가지 방안:

**방안 A**: 같은 함수 유지, ContractData에 상용직 필드 추가
  - 장점: 변경 최소화
  - 단점: 함수가 계속 비대해짐

**방안 B**: `buildDailyContractData` / `buildRegularContractData`로 분리
  - 장점: 명확한 책임 분리, 각 유형에 필요한 필드만 다룸
  - 단점: 초기 분리 작업 필요

**권장: 방안 B** — 단, 이번 단계가 아니라 다음 구현 단계에서 수행.

### 5-3. PDF 생성 분기 (generate-pdf)

현재 분기 (유지):
```typescript
if (tmpl === 'REGULAR_EMPLOYMENT')         rendered = renderRegularEmploymentContract(base, false)
else if (tmpl === 'FIXED_TERM_EMPLOYMENT') rendered = renderRegularEmploymentContract(base, true)
else if (tmpl === 'MONTHLY_FIXED_EMPLOYMENT') rendered = renderMonthlyFixedContract(base)
else if (tmpl === 'CONTINUOUS_EMPLOYMENT') rendered = renderContinuousContract(base)
else rendered = renderDailyEmploymentContract(base)  // 기본 = 일용직
```
분기 로직은 이미 있음. 렌더러도 있음. **generate-pdf는 수정 불필요.**

### 5-4. 문서 생성 UI 분기 (generate-doc)

계약 상세 화면에서 문서 생성 버튼 목록은 DOC_PACKAGES 기준으로 표시됨.
상용직 계약에 일용직 문서(`WORK_CONDITIONS_RECEIPT` workDate 버전)가 생성되지 않도록 차단 필요.

```typescript
// 계약 상세 화면의 문서 생성 목록 결정 로직 (예정)
const packageKey = getDocPackageForTemplate(contract.contractTemplateType)
const availableDocs = DOC_PACKAGES[packageKey]
```

---

## 6. 근로조건 설명 확인서 분기 설계

현재 `renderWorkConditionsReceipt`는 일용직 특화. 상용직 버전 분기 필요.

### 방안

```typescript
// generate-doc switch (WORK_CONDITIONS_RECEIPT 케이스 수정 예정)
case 'WORK_CONDITIONS_RECEIPT': {
  const tmpl = contract.contractTemplateType as string
  const isRegular = ['REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT'].includes(tmpl)
  if (isRegular) {
    // 상용직 버전: workDate 대신 startDate, monthlySalary, 주소정근로시간 사용
    return renderWorkConditionsReceiptRegular({ ...base, ... })
  }
  return renderWorkConditionsReceipt({ ...base, ... })  // 기존 일용직 버전 유지
}
```

> `renderWorkConditionsReceiptRegular` 함수는 다음 구현 단계에서 safety-docs.ts에 추가.

---

## 7. 4대보험 기본값 분기

```typescript
// UI handleTemplateChange 함수 수정 예정
function handleTemplateChange(tmpl: string) {
  const isRegular = ['REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT'].includes(tmpl)
  setForm(f => ({
    ...f,
    contractTemplateType: tmpl,
    contractKind: CONTRACT_KIND_BY_TEMPLATE[tmpl] || f.contractKind,
    // 상용직이면 4대보험 전체 ON
    ...(isRegular ? {
      nationalPensionYn: true,
      healthInsuranceYn: true,
      employmentInsuranceYn: true,
      industrialAccidentYn: true,
    } : {})
  }))
}
```
