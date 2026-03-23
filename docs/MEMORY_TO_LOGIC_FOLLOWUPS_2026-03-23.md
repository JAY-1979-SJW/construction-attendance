# 메모리 → 로직 변환 후속 과제

- 작성일: 2026-03-23
- 목적: 이번 단계에서 로직화하지 못한 항목과 우선순위

---

## 즉시 처리 (다음 세션)

### F-1. ~~crontab 서버 실제 적용 확인~~ ✅ 완료

- **확인 결과**: 2026-03-23 `crontab -l`로 확인. 모든 cron 이미 적용됨
  - `0 4 * * *` — 자동 퇴근 ✓
  - `*/15 * * * *` — 체류확인 만료 ✓
  - `*/10 * * * *` — 체류확인 푸시 ✓
  - `0 1 * * *` — 공수 집계 ✓
  - 보험요율 고시 소스 모니터링 (1~7월/8~12월 분기) ✓

### F-2. 위험 문구 경고 → 관리자 UI 노출

- **내용**: generate-pdf API가 이제 `warnings` 배열을 반환하지만, 관리자 UI에서 이를 표시하지 않음
- **대상 파일**: `app/admin/contracts/[id]/page.tsx` — PDF 생성 버튼 클릭 후 응답 처리
- **구현 내용**: `json.data.warnings`가 있으면 노란 경고박스로 표시
- **레이어**: UI
- **우선순위**: 즉시

---

## 높음 (이번 sprint)

### H-1. Worker.bankAccount 레거시 데이터 마이그레이션

- **내용**: `Worker.bankAccount` 컬럼에 레거시 평문 계좌번호 잔존. 신규 API는 `WorkerBankAccountSecure`만 사용하지만 기존 데이터 미이전
- **레이어**: DB 마이그레이션 스크립트
- **구현 내용**:
  1. Worker.bankAccount 값 있는 레코드 조회
  2. WorkerBankAccountSecure 레코드 생성 (마스킹값 + 실제값)
  3. Worker.bankAccount → null 처리
- **우선순위**: 높음 (개인정보 보호법 대응)

### H-2. COMPANY_ADMIN API 스코프 전수 점검

- **내용**: 플랫폼 재설계 지시문에서 "COMPANY_ADMIN: 모든 API에서 companyId 강제"가 원칙이지만, 일부 API에서 누락 가능
- **레이어**: API 인가 레이어
- **확인 대상**: `app/api/admin/` 하위 라우트 전수 점검 → COMPANY_ADMIN 세션에서 타 업체 데이터 접근 가능 여부
- **우선순위**: 높음 (멀티테넌트 보안)

### H-3. 스냅샷 — workerName/workerPhone 추가

- **내용**: worker_contracts에 workerNameSnapshot, workerPhoneSnapshot 없음. 마스터 변경 시 계약서 출력값이 달라짐
- **레이어**: DB 컬럼 추가, API 저장 로직, PDF 생성 로직
- **구현 내용**:
  1. `worker_contracts` — `workerNameSnapshot String?`, `workerPhoneSnapshot String?` 컬럼 추가
  2. 계약 생성 API에서 worker.name, worker.phone 스냅샷 저장
  3. generate-pdf의 `buildContractData`에서 workerNameSnapshot 우선 사용
- **우선순위**: 높음

---

## 보통 (다음 달)

### M-1. 위험 문구 검출 — 차단 레벨 상향 검토

- **내용**: 현재는 경고(warning)만 반환. 관리자가 확인하지 않고 넘어갈 수 있음
- **방안**: 심각도 분류 (CRITICAL 패턴은 차단, WARNING 패턴은 경고)
- **레이어**: validate-contract.ts 로직 개선 + UI
- **우선순위**: 보통

### M-2. 감사로그 beforeJson/afterJson 전면화

- **내용**: writeAdminAuditLog 현재 description 문자열만 사용. beforeJson/afterJson 미포함
- **레이어**: AuditLog 모델 + writeAdminAuditLog 함수 확장
- **우선순위**: 보통

### M-3. 체류확인 planType 자동 연동

- **내용**: 현재 presenceCheckFeatureAvailable을 수동으로 SUPER_ADMIN이 설정. planType(free/standard/premium) 기반 자동 활성화 미구현
- **레이어**: AppSettings + plan_type 연동 로직
- **우선순위**: 보통

---

## 후순위 (Phase 1~5)

### P-1. worker_profiles 4계층 분류 테이블

- **내용**: worker_class / employment_mode / tax_mode / insurance_mode 4계층 분류 DB 모델
- **레이어**: DB 스키마, API, 분류 엔진
- **구현 단계**: Phase 1
- **우선순위**: 후순위

### P-2. 근로형태 자동 판정 엔진

- **내용**: 계약+근무패턴+관리자지정 → employment_mode/tax_mode 자동 판정
- **레이어**: 서비스 레이어 (lib/labor/classification-engine.ts)
- **구현 단계**: Phase 4
- **우선순위**: 후순위

### P-3. Python 급여/노임 계산 엔진

- **내용**: 별도 Python 서비스. payroll/policies/calculators 구조
- **구현 단계**: Phase 5
- **우선순위**: 후순위

### P-4. 계속근로/월 60일 초과 시 보험 검토 자동 플래그

- **내용**: "일용직 월 기준 초과 시 보험 검토 플래그" 규칙
- **레이어**: 근로형태 판정 엔진 or 월마감 서비스
- **우선순위**: 후순위

### P-5. OFFICE_SERVICE / FREELANCER_SERVICE 계약서 렌더러

- **내용**: UI 선택지에 있으나 렌더러 미구현
- **레이어**: lib/contracts/templates.ts
- **우선순위**: 후순위

---

## 이번 단계 제외 이유

| 항목 | 제외 이유 |
|------|-----------|
| worker_profiles 4계층 | Phase 1 전체 설계 작업 필요. 단독 실행 불가 |
| Python 엔진 | 별도 서비스 인프라 설계 필요 |
| bankAccount 마이그레이션 | 기존 데이터 정합성 확인 선행 필요. 별도 세션에서 집중 처리 |
| COMPANY_ADMIN 전수 점검 | API 라우트 전수 검토 필요. 별도 감사 작업 |
| 위험 문구 차단 레벨 상향 | 현재 경고 수준으로 운영 영향 없음. 충분히 안전 |
