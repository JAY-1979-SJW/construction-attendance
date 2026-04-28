# attendance 운영 기준선 — 2026-04-28

점검 완료: 2026-04-28 12:04 KST  
점검 범위: 앱 전체 점검 1~6단계

---

## 현재 운영 상태

| 서비스 | 컨테이너 상태 | health |
|--------|------------|--------|
| attendance | Up (healthy) | 200 `{"status":"ok","service":"construction-attendance"}` |
| material-api | Up (healthy) | 200 |
| common-db | Up (healthy) | DB 포트 정상 |
| nginx | Up | — |

도메인: `attendance.haehan-ai.kr` — 200 정상 응답 확인

---

## ops-check 기준선 (18항목)

- PASS: 17건
- WARN: 1건 (`audit-fk-check` — 상세 아래)
- FAIL: 0건

---

## 잔여 WARN — known legacy warn

### audit-fk-check R4 17건

| 항목 | 판정 |
|------|------|
| 규칙 | R4: `writeAdminAuditLog()` 사용 (레거시 함수) |
| 해당 파일 | contracts 11건, safety-documents 3건, workers/profile 2건, workers/safety-documents 1건 |
| R1/R2/R3 위반 | **0건** — FK 선조회 위반 없음, 데이터 무결성 문제 없음 |
| 운영 영향 | 없음. `admin_audit_logs` 테이블 정상 적재 중 |
| 판정 근거 | `write-audit-log.ts` 내 `/** 레거시 */` 명시. ops-check 스크립트 자체가 R4를 "선택적 개선 대상"으로 분류 |
| 향후 처리 | contracts/safety-documents 도메인 단위 `writeAuditLog` v2 이관 — 별도 계획 시 처리 |

**다음 ops-check부터 이 WARN은 "known legacy warn"으로 해석. 즉시 조치 불필요.**

---

## bulk-e2e freshness 기준선

- 마지막 실행: 2026-04-28 12:03:21
- 결과: PASS (44 passed, 7 spec 전체)
- 포함 spec: work-confirmations / presence-checks / attendance / workers-bulk-education / site-join-requests / device-requests / company-admin-requests
- 갱신 주기: `deploy-and-verify.sh` 표준 배포 시 자동 갱신

---

## 운영 인프라 기준선

| 항목 | 상태 |
|------|------|
| DB 백업 | 매일 02:00 KST, NAS `/mnt/nas/attendance/backups/`, 30일 보관 |
| NAS 마운트 | `/mnt/nas/attendance` NFS4 정상 |
| ops-check 일별 크론 | 매일 09:00 KST 자동 실행 (2026-04-28 등록) |
| ops_daily_report | 매일 07:00 KST 자동 실행 |
| 디스크 사용률 | 35% (정상) |

---

## 즉시 수정 필요 항목

**없음 (0건)**

---

## 별도 계획 항목

| 항목 | 내용 | 우선순위 |
|------|------|---------|
| audit R4 이관 | contracts/safety-docs/workers-profile → `writeAuditLog` v2 | LOW |
| bid-worker-company unhealthy | 외부 API 404 + DB ON CONFLICT (g2b 범위) | MEDIUM (g2b 별도) |
| Google OAuth InvalidCheck | 24h 1회 산발 발생, 재시도 시 정상 | LOW (모니터링) |

---

## Google OAuth InvalidCheck 모니터링 기준

### 발생 현황 (2026-04-28 기준)

| 기간 | 횟수 |
|------|------|
| 최근 7일 | 1회 |
| 최근 24시간 | 1회 |

- 발생 위치: `/api/auth/callback/google` 콜백 처리 중 (Auth.js state 검증 단계)
- 동반 auth 오류: 없음 (단독 발생)
- 컨테이너 재시작: 2026-04-28 02:41 KST (배포) — 이전 로그 미보존
- nginx 로그 확인: `GET /api/auth/callback/google 302` — 콜백 자체는 302 리다이렉트로 처리됨

### 원인 추정 (코드상 확인)

Auth.js `InvalidCheck`는 OAuth state 쿠키가 콜백 시점에 소실되거나 파싱 불가할 때 발생.  
주요 시나리오: 새 탭 로그인, 뒤로가기 후 재시도, 쿠키 만료, 브라우저 개인정보보호 모드.  
재시도 시 정상 로그인 가능 — 세션 자체 손상 아님.

### 영향도

**LOW** — 단발성, 로그인 실패 후 재시도 시 정상. 다수 사용자 동시 영향 없음. 운영 장애 아님.

### 모니터링 기준

| 조건 | 판정 | 조치 |
|------|------|------|
| 24시간 1~3회 이내 | 정상 범위 | 모니터링만 |
| 24시간 10회 이상 또는 특정 시간대 집중 | 조사 필요 | 원인 분석 후 판단 |
| 로그인 실패 지속 + 재시도도 실패 | 즉시 수정 검토 | Auth.js 세션/쿠키 설정 점검 |

**현재(1회/24h): 모니터링만. 코드 수정 불필요.**

---

## g2b 분리 관리 항목 — bid-worker-company

### 현재 상태 (2026-04-28 기준)

| 항목 | 내용 |
|------|------|
| 컨테이너 상태 | running **healthy** (2026-04-19 기동) |
| 네트워크 | `g2b_g2b-net` 전용 — attendance-net과 분리 |
| 다른 g2b worker | bid-worker-notice / contract / result 모두 healthy |

### 에러 패턴 (최근 24h)

| 에러 유형 | 횟수 | 내용 |
|---------|------|------|
| 외부 API 404 (`getUnptRsttCorpInfo02`) | 2,559회 | 나라장터 USR_API 일부 사업자번호 데이터 없음 |
| `ON CONFLICT` DB 오류 | 23회 | unique constraint 미정의로 upsert 실패 |
| 타임아웃 | 1회 | 업체 면허 보강 타임아웃 |
| 처리 성공 | ok=2,557 / 3,240 (78%) | 나머지는 skip 0, fail 23 |

**healthcheck 판정**: 현재 `healthy` — 과거 unhealthy는 배치 중간 상태였던 것으로 추정

### attendance 직접 영향 여부

**없음** — 네트워크 완전 분리 (`g2b_g2b-net` vs `attendance-net`). DB 공유 없음.

### 영향도

- attendance 기준: **영향 없음 — 모니터링 대상 아님**
- g2b 기준: **MEDIUM** — 외부 API 404가 정상 데이터 없는 사업자 처리 결과(예상 범위)인지, API 장애인지 구분 필요. ON CONFLICT 23건은 DB 스키마 보정 필요 신호.

### 분리 관리 기준

| 조건 | attendance 판정 | g2b 판정 |
|------|----------------|---------|
| bid-worker-company unhealthy | 무관 | g2b 운영 확인 |
| 외부 API 404 (일부 사업자) | 무관 | 정상 범위 모니터링 |
| 외부 API 404 전체 급증 (>80%) | 무관 | API 장애 조사 |
| ON CONFLICT 반복 (>50건/일) | 무관 | DB unique constraint 추가 검토 |
| ok율 50% 미만 지속 | 무관 | g2b 즉시 수정 |

**attendance ops-check에서 이 항목은 점검 범위 아님. g2b 앱 별도 운영 기준으로 관리.**

---

## audit R4 이관 계획 (known legacy warn → v2 전환)

### 이관 배경

- 현재: `writeAdminAuditLog()` → `admin_audit_logs` 테이블 (구형)
- 목표: `writeAuditLog()` → `audit_logs` 테이블 (v2, beforeJson/afterJson 지원)
- 긴급도: **없음** — R1/R2/R3 위반 0건, 운영 장애 없음
- 현재 상태: known legacy warn으로 유지

### 도메인별 이관 대상

| 도메인 | 파일 수 | 현재 방식 | 목표 방식 | 병행 사용 |
|--------|--------|---------|---------|---------|
| contracts | 11개 | `writeAdminAuditLog` | `writeAuditLog` v2 | contracts/route.ts는 두 함수 혼용 |
| safety-documents | 3개 | `writeAdminAuditLog` | `writeAuditLog` v2 | 없음 |
| workers/profile | 1개 (2호출) | `writeAdminAuditLog` | `writeAuditLog` v2 | 없음 |
| workers/safety-documents | 1개 | `writeAdminAuditLog` | `writeAuditLog` v2 | 없음 |

### 이관 원칙

1. **도메인 단위 일괄 이관** — 한 파일씩 반만 바꾸면 같은 도메인 내 audit 방식이 혼재해서 감사 통합 조회 시 누락 발생
2. contracts/route.ts는 이미 `writeAuditLog`도 혼용 중 → contracts 도메인 이관 시 이 파일도 함께 정리
3. 이관 후 `admin_audit_logs`에만 있던 이력은 마이그레이션 대상 아님 (신규 이벤트부터 v2 적재)
4. R4 suppress는 추가하지 않음 — 이관 완료 후 자연히 WARN 감소

### 우선순위

| 순위 | 도메인 | 이유 |
|------|--------|------|
| 1 | `workers/profile` | 파일 1개, 호출 2건 — 가장 작은 단위. 이관 패턴 확인용 |
| 2 | `safety-documents` | 3개 파일, 독립 도메인 — contracts와 무관해서 안전 |
| 3 | `workers/safety-documents` | 1개 파일 — safety-documents 이관 후 연속 처리 가능 |
| 4 | `contracts` | 11개 파일 — 가장 많고 비즈니스 중요도 높아 마지막 |

### 도메인별 작업 단위

| 도메인 | 수정 파일 | 테스트 범위 | 위험도 | 선행 조건 | 단계 |
|--------|---------|-----------|--------|---------|------|
| workers/profile | 1개 | E2E: workers 화면 수정 동작 | LOW | 없음 | 1단계 |
| safety-documents | 3개 | E2E: safety-documents 업로드/서명/리뷰 | LOW | 없음 | 1단계 |
| workers/safety-documents | 1개 | E2E: workers/safety-documents 목록+등록 | LOW | safety-documents 이관 후 | 1단계 |
| contracts | 11개 | E2E: contracts 전체 플로우 (activate/sign/review/deliver/end) | MEDIUM | 위 3개 이관 완료 후 패턴 확인 | 별도 계획 |

**현재 조치: 없음. 다음 contracts 기능 작업 또는 별도 이관 스프린트 시 처리.**
