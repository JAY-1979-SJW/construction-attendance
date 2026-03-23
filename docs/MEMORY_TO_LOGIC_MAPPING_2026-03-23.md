# 메모리 → 로직 변환 매핑 문서

- 작성일: 2026-03-23
- 목적: 메모리/결정사항을 실제 시스템 로직으로 변환한 현황 기록

---

## 판정 기준

- **이미 반영**: 실제 코드/스키마에서 확인됨
- **일부 반영**: 일부 레이어만 반영, 나머지 미완
- **미반영**: 설계/메모리에만 있고 코드 없음

---

## A. 근로/출퇴근/공수 규칙

### A-1. 공수 1.0 인정 규칙 (실근로 8시간 기준)

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "오전 7시~오후 4시 근무해야 1.0 공수 인정" |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `lib/labor/work-confirmations.ts` `calcWorkUnits()` |
| 근거 코드 | effectiveMinutes ≥ 480 → FULL_DAY 1.0 / ≥ 240 → HALF_DAY 0.5 |
| 조치 | 주석을 정확화 완료 (07:00~16:00은 예시, 실제는 분 기준 계산) |
| 우선순위 | 완료 |

### A-2. 출근 가능 시간 (05:00~)

| 항목 | 내용 |
|------|------|
| 메모리 내용 | CHECKIN_ALLOWED_START_TIME=05:00 (.env) |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `.env`, attendance-engine.ts |
| 주의 | 공수 주석의 "07:00" 예시와 혼동 방지 필요 → 주석 수정 완료 |
| 우선순위 | 완료 |

### A-3. 점심 60분 자동 차감

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "경과 4시간 초과 시 점심 1시간 차감" |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `lib/labor/work-confirmations.ts` L29: `workedMinutesRaw > 240 ? workedMinutesRaw - 60 : workedMinutesRaw` |
| 비고 | 근로기준법 기반 고정값. 설정값 아님. |
| 우선순위 | 완료 |

### A-4. MISSING_CHECKOUT / INVALID presenceStatus → 공수 0

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "미퇴근 / 무효 → 공수 불인정" |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `lib/labor/work-confirmations.ts` L24 |
| 우선순위 | 완료 |

### A-5. 공수 수정 정책 (workedMinutesOverride)

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "업체 관리자가 자기 업체 공수 자율 수정. AttendanceDay에 workedMinutesAuto/Override/RawFinal 추가" |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `prisma/schema.prisma` AttendanceDay 모델, `workedMinutesRaw`, `workedMinutesOverride`, `workedMinutesRawFinal`, `manualAdjustedYn` |
| 우선순위 | 완료 |

### A-6. 자동 퇴근 (04:00 KST, MISSING_CHECKOUT 전환)

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "매일 04:00 KST 미퇴근 자동 처리" |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `lib/jobs/autoCheckout.ts`, `scripts/run-auto-checkout.ts` |
| 비고 | `deploy/crontab.txt` 생성됨 — 서버 실제 적용 여부 별도 확인 필요 |
| 우선순위 | 완료 (서버 cron 적용 확인은 후속 과제) |

---

## B. 계약/문서 규칙

### B-1. 일용직 계약서 위험 문구 제거 원칙

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "계속고용 보장, 상시근로, 무기계약, 정규직 표현 금지" |
| 현재 상태 | **이번에 로직화 완료** |
| 반영 위치 | `lib/contracts/validate-contract.ts` — `validateDailyContractDangerPhrases()` 신규 |
| 반영 위치 2 | `app/api/admin/contracts/[id]/generate-pdf/route.ts` — DAILY_EMPLOYMENT 생성 시 위험 문구 검출, 경고 반환 |
| 우선순위 | 완료 |

### B-2. renderDailyEmploymentContract 내 안전장치

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "계속적·상시적 고용을 보장하지 않습니다" 명시 원칙 |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `lib/contracts/templates.ts` L179: "본 계약은 계속적·상시적 고용을 보장하지 않습니다" |
| 우선순위 | 완료 |

### B-3. [관리자] 라벨 vs PDF 출력 분리

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "관리자용 라벨은 PDF 본문에 노출 금지" |
| 현재 상태 | **이미 반영** |
| 근거 | TEMPLATE_BY_RELATION UI 배열의 `[관리자]` prefix는 UI label에만 사용. generate-pdf는 templateType 기반으로 렌더러 호출 → label 미포함 |
| 우선순위 | 완료 |

### B-4. 스냅샷 불변성 (계약 생성 시점 고정)

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "생성 시점 스냅샷 저장. 마스터 변경 시 기존 계약 불변." |
| 현재 상태 | **일부 반영** |
| 반영됨 | worker_contracts: companyName, companyPhone, companyBizNo, companyAddress, companyRepName, workerBirthDate, workerBankName, workerAccountNumber, workerAccountHolder, workDate |
| 반영됨 | AttendanceLog: companyNameSnapshot, employmentTypeSnapshot, tradeTypeSnapshot |
| 미반영 | workerName, workerPhone, siteName은 마스터에서 live 조회 (worker_contracts에 스냅샷 없음) |
| 조치 필요 | worker_contracts에 workerNameSnapshot, workerPhoneSnapshot 추가 고려 (후순위) |
| 우선순위 | 보통 |

### B-5. 자동 채움 원칙 (회사/근로자/현장 선택 → 스냅샷 필드 자동 입력)

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "회사/근로자/현장 선택 시 관련 필드 자동 채움" |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `app/admin/contracts/new/page.tsx` handleCompanyChange, handleWorkerChange, handleSiteChange |
| 우선순위 | 완료 |

### B-6. 상용직 계약서 체계 분리

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "REGULAR_EMPLOYEE DOC_PACKAGES 분리, getDocPackageForTemplate() 추가" |
| 현재 상태 | **이미 반영 (v3.7)** |
| 반영 위치 | `lib/contracts/index.ts`, `safety-docs.ts`, `generate-doc/route.ts`, `[id]/page.tsx` |
| 우선순위 | 완료 |

---

## C. 보안/운영 규칙

### C-1. 유료 플랜 + 체류확인 기능 게이트

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "체류확인 기능은 유료 플랜 전용. presenceCheckFeatureAvailable=false 기본값" |
| 현재 상태 | **일부 반영 → 이번에 강화 완료** |
| 기존 반영 | 설정 변경 API에서 `!current.presenceCheckFeatureAvailable` 체크 (`app/api/admin/settings/attendance/route.ts`) |
| 이번 추가 | `lib/attendance/presence-scheduler.ts` — featureAvailable 체크를 enabled 체크 앞에 추가 |
| 비고 | planType(DB String) 기반 자동 전환은 미구현. featureAvailable boolean으로 수동 관리 중. |
| 우선순위 | 완료 |

### C-2. bankAccount 레거시 컬럼 정리

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "Worker.bankAccount 레거시 평문 컬럼 잔존. 신규 API는 WorkerBankAccountSecure만 사용" |
| 현재 상태 | **일부 반영** |
| 반영됨 | 신규 계약 생성 API, 근로자 조회 API → WorkerBankAccountSecure 사용 |
| 미반영 | Worker.bankAccount 컬럼 DB에 잔존. 데이터 마이그레이션 미실시 |
| 조치 필요 | 마이그레이션 스크립트로 기존 bankAccount → WorkerBankAccountSecure 이전 후 컬럼 null 처리 |
| 우선순위 | 높음 (개인정보 보호) |

### C-3. 복호화 권한 SUPER_ADMIN_ONLY

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "sensitive/decrypt, bank/decrypt 모두 SUPER_ADMIN_ONLY 적용" |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `lib/auth/guards.ts` |
| 우선순위 | 완료 |

### C-4. QR만으로 출근 승인 금지 (GPS 필수)

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "QR만으로 출근 승인 금지. GPS 없이 출퇴근 승인 금지." |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `lib/attendance/attendance-engine.ts` — GPS 검증 필수 단계 포함 |
| 우선순위 | 완료 |

### C-5. 출퇴근 기록에 회사 스냅샷 저장 필수

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "출퇴근 기록에 당시 회사 스냅샷 저장 필수" |
| 현재 상태 | **이미 반영** |
| 반영 위치 | AttendanceLog: companyNameSnapshot, employmentTypeSnapshot, tradeTypeSnapshot |
| 우선순위 | 완료 |

---

## D. 멀티테넌트/권한 체계

### D-1. COMPANY_ADMIN 데이터 스코프

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "COMPANY_ADMIN: 모든 API에서 companyId === session.companyId 강제" |
| 현재 상태 | **일부 반영** |
| 반영됨 | COMPANY_ADMIN 역할 enum, /company 경로 분리, 미들웨어 |
| 미반영 | 일부 API에서 companyId 스코프 미적용 가능성 있음 (전수 점검 필요) |
| 우선순위 | 높음 |

### D-2. 감사로그 필수화

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "AuditLog에 beforeJson, afterJson, reason, actorRole, companyId 포함" |
| 현재 상태 | **일부 반영** |
| 반영됨 | `writeAdminAuditLog()` 사용 중. 계약 생성/문서 생성에서 호출 |
| 미반영 | beforeJson/afterJson 미포함 케이스 다수. actorRole, companyId 일부 누락 |
| 우선순위 | 보통 |

---

## E. v3 다중 근로형태 설계

### E-1. worker_profiles 4계층 분류

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "worker_class / employment_mode / tax_mode / insurance_mode 4계층" |
| 현재 상태 | **미반영 (설계 단계)** |
| 현재 위치 | 메모리 `project_v3_multiworker_design.md`에만 존재 |
| 반영 레이어 | DB(prisma), API, UI, 분류 엔진 |
| 조치 필요 | Phase 1 착수 시 prisma schema에 worker_profiles 모델 추가 |
| 우선순위 | 후순위 (Phase 1) |

### E-2. Python 급여/노임 계산 엔진

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "E 모듈: Python 별도 서비스 (payroll/policies/calculators/services)" |
| 현재 상태 | **미반영 (설계 단계)** |
| 우선순위 | 후순위 (Phase 5) |

### E-3. 계속근로/사무실 상주 자동 REVIEW_REQUIRED 플래그

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "사무실 상주+반복출근+용역계약 → 자동 REVIEW_REQUIRED" |
| 현재 상태 | **미반영** |
| 반영 레이어 | 근로형태 판정 엔진 (Phase 4) |
| 우선순위 | 후순위 |

---

## F. 보험 요율 규칙

### F-1. 보험요율 자동 반영 금지

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "자동 반영 금지 — 관리자 검토 후 수동 등록 원칙" |
| 현재 상태 | **이미 반영** |
| 반영 위치 | `app/api/cron/check-rate-sources/route.ts` — 접근성 확인만. APPROVED_FOR_USE는 관리자가 수동 설정 |
| 우선순위 | 완료 |

### F-2. crontab 서버 적용

| 항목 | 내용 |
|------|------|
| 메모리 내용 | "`deploy/crontab.txt` 생성 완료" |
| 현재 상태 | **일부 반영** |
| 미반영 | 서버에서 `crontab -l`로 실제 적용 여부 확인 필요 |
| 우선순위 | 높음 |

---

## 요약 카운트

| 상태 | 건수 |
|------|------|
| 이미 반영됨 | 13건 |
| 이번에 로직화 완료 | 3건 |
| 일부 반영 (후속 필요) | 4건 |
| 미반영 (Phase 1~5 대상) | 3건 |
