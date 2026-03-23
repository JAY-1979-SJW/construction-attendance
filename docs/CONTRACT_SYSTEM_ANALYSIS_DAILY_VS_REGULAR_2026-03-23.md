# 계약/문서 시스템 구조 분석 — 일용직 vs 상용직/계속근로자

- 작성일: 2026-03-23
- 분석 기준: 실제 코드/DB/UI 구조

---

## 1. 현재 계약 유형 분류 체계

### 1-1. ContractTemplateType enum (현재)

| enum 값 | 사용 현황 | 분류 |
|---------|-----------|------|
| `DAILY_EMPLOYMENT` | 구현 완료 | 일용직 |
| `REGULAR_EMPLOYMENT` | 렌더러 있음, 문서패키지 없음 | 상용직 |
| `FIXED_TERM_EMPLOYMENT` | 렌더러 있음, 문서패키지 없음 | 기간제 상용직 |
| `MONTHLY_FIXED_EMPLOYMENT` | 렌더러 있음 (`[관리자]` 표시) | 월단위 기간제 (일용직 유사) |
| `CONTINUOUS_EMPLOYMENT` | 렌더러 있음 (`[관리자]` 표시) | 계속근로형 (상용직 유사) |
| `SUBCONTRACT_WITH_BIZ` | 구현 완료 | 외주 |
| `NONBUSINESS_TEAM_REVIEW` | 구현 완료 | 팀장형 |
| `OFFICE_SERVICE` | UI 선택지에만 있음, 렌더러 없음 | 사무보조 |
| `FREELANCER_SERVICE` | UI 선택지에만 있음, 렌더러 없음 | 프리랜서 |

### 1-2. 근로형태 분류 현황

```
직접고용 (laborRelationType = DIRECT_EMPLOYEE)
  ├─ 일용직
  │    ├─ DAILY_EMPLOYMENT          ← 일용직 마감 완료
  │    ├─ MONTHLY_FIXED_EMPLOYMENT  ← 일용직 확장형 (미완성)
  │    └─ CONTINUOUS_EMPLOYMENT     ← 계속근로 (미완성)
  └─ 상용직 (미완성)
       ├─ REGULAR_EMPLOYMENT
       └─ FIXED_TERM_EMPLOYMENT
```

---

## 2. 일용직 전용으로 굳어져 있는 부분

### 2-1. 문서 패키지 (lib/contracts/index.ts)

```typescript
DOC_PACKAGES.DIRECT_EMPLOYEE = [
  CONTRACT,
  WORK_CONDITIONS_RECEIPT,   // 일용직 특화 (workDate 사용)
  PRIVACY_CONSENT,
  BASIC_SAFETY_EDU_CONFIRM,
  SITE_SAFETY_RULES_CONFIRM,
  ...
]
```

`REGULAR_EMPLOYMENT`, `FIXED_TERM_EMPLOYMENT`에 대응하는 문서 패키지가 없음.

### 2-2. UI 폼 (app/admin/contracts/new/page.tsx)

```typescript
const isDailyType = ['DAILY_EMPLOYMENT', 'MONTHLY_FIXED_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT']
  .includes(form.contractTemplateType)
```

이 플래그로 일용직/월단위/계속근로를 묶고, REGULAR/FIXED_TERM을 상용직 취급하지만 UI 분기가 명확하지 않음. 실제로 상용직 전용 입력 섹션(시용기간, 기본급+수당 구조, 연차 설정)이 없음.

### 2-3. contractToTemplateData (generate-doc/route.ts)

- `jobTitle: (contract.notes as string) || '건설일용직'` — 기본값이 일용직 기준
- `workDate` 필드가 일용직 기준으로만 사용됨

### 2-4. 렌더러 기본값

`renderDailyEmploymentContract`가 generate-pdf의 `else`(default) 분기에 위치 → 유형 미지정 시 일용직으로 폴백.

---

## 3. 공통으로 재사용 가능한 부분

### 3-1. ContractData 인터페이스 (templates.ts)

이미 상용직에 필요한 대부분의 필드를 포함:
- `monthlySalary`, `weeklyWorkDays`, `weeklyWorkHours`
- `probationYn`, `probationMonths`
- `holidayRule`, `annualLeaveRule`
- `allowanceJson` (수당 항목)
- `companyName`, `companyCeo`, `companyAddress`, `companyBizNo`
- `workerName`, `workerBirthDate`, `workerAddress`, `workerPhone`
- `checkInTime`, `checkOutTime`, `breakHours`

### 3-2. worker_contracts 테이블

이미 상용직 필요 필드 대부분 존재:
- `monthlySalary`, `weeklyWorkDays`, `weeklyWorkHours`
- `probationYn`, `probationMonths`
- `holidayRule`, `annualLeaveRule`
- `allowanceJson`
- 회사·근로자 스냅샷 필드 전체

**DB 구조 변경 없이 상용직 계약 저장 가능**

### 3-3. 공통 문서

- 개인정보 수집·이용 동의서 → 근로형태 무관, 그대로 재사용 가능
- 기초안전보건교육 확인서 → 그대로 재사용 가능
- 현장 안전수칙 준수 확인서 → 그대로 재사용 가능
- 근로조건 설명 확인서 → 일용직 특화 부분(workDate) 있으나 조건부 재사용 가능

### 3-4. 템플릿 렌더러

`renderRegularEmploymentContract(base, isFixedTerm)` — 이미 구현 완료. 상용직/기간제 분기 포함.

### 3-5. Validation·저장·생성 기반 구조

`route.ts` (계약 생성), `generate-pdf`, `generate-doc` 구조 자체는 재사용 가능. contractTemplateType 분기만 추가하면 됨.

---

## 4. 상용직/계속근로자에서 추가 또는 변경이 필요한 부분

### 4-1. 문서 패키지 신규 정의 필요

현재 `DOC_PACKAGES`에 상용직/기간제용 패키지 없음. 신규 정의 필요.

### 4-2. UI 입력 섹션 분리 필요

상용직에서 추가 입력이 필요한 항목:
- 기본급 (monthlySalary) — 일용직의 dailyWage와 구분
- 수당 구조 (allowanceJson)
- 시용기간 (probationYn, probationMonths)
- 주 소정근로일/시간 (weeklyWorkDays, weeklyWorkHours) — 현재 UI에 있으나 일용직과 혼재
- 연차유급휴가 적용 방식 (annualLeaveRule)
- 계약기간 (endDate) — 기간제 필수, 상용직 불필요
- 퇴직금 적용 여부 — 현재 retirementMutualYn으로만 있음 (퇴직공제와 퇴직금 구분 필요)

### 4-3. 근로조건 설명 확인서 분기 필요

현재 `renderWorkConditionsReceipt`는 `workDate` 필드를 사용하여 근로일을 표시함 (일용직 특화). 상용직 버전은 `startDate`와 계약기간을 사용하는 별도 문안 또는 분기 필요.

### 4-4. 4대보험 기본값 분기

- 일용직: 산재만 기본 ON
- 상용직: 4대보험 모두 ON이 일반적

현재 UI에서 이 분기가 `laborRelation === 'DIRECT_EMPLOYEE'`로만 처리됨. 템플릿 유형별 분기 필요.

### 4-5. 문안 확정 필요

현재 `renderRegularEmploymentContract`과 `renderContinuousContract`는 구현되어 있으나, 운영 기준 문안 검토가 필요함. 특히:
- 연차 조항 (상용직 필수)
- 퇴직금/퇴직공제 구분
- 기간제 갱신 제한 (2년 초과 무기계약 전환 문구)

---

## 5. 핵심 분리 포인트 요약

| 구분 | 일용직 | 상용직/기간제 |
|------|--------|--------------|
| 계약 단위 | 1일 (workDate) | 계약기간 (startDate~endDate) |
| 임금 기준 | 일당 (dailyWage) | 월급 (monthlySalary) + 수당 |
| 4대보험 기본 | 산재 단독 | 4대 전체 |
| 연차 조항 | 없음 (일용직 해당 없음) | 필수 |
| 퇴직금 | 공수 기준 퇴직공제 | 계속근로 퇴직금 |
| 계약기간 | 당일 | 기간제/무기 구분 |
| 시용기간 | 없음 | 선택 있음 |
| 문서 패키지 | 5종 완성 | 미정의 |
| UI 입력 | 완성 | 미완 |
