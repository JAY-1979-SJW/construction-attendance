# 메모리 로직화 후속 보강 1차 마감 보고서 (2026-03-23)

## 1. 이번 단계 목표

메모리→로직 변환 작업의 미반영 항목 중 운영 리스크가 큰 4건을 실제 코드 기준으로 점검·수정·재검증.

1. 위험 문구 경고를 관리자 UI에 노출
2. COMPANY_ADMIN API 스코프 전수 점검 및 누락 보정
3. bankAccount 레거시 구조 정리
4. workerName 스냅샷 필요 여부 확정 및 반영

---

## 2. 과제별 점검 결과

### 위험 문구 UI 노출

| 항목 | 결과 |
|------|------|
| API 반환 여부 | `generate-pdf/route.ts`에서 `warnings` 배열 반환 확인 (L194-196) |
| UI 처리 여부 (수정 전) | `contracts/[id]/page.tsx`에서 `warnings` 완전 무시 |
| 수정 내용 | `dangerWarnings` state 추가, `generatePdf()` 함수에서 처리, 경고 박스 UI 추가 |
| 반영 화면 | `/admin/contracts/[id]` — 계약 상세 페이지 |
| 노출 방식 | PDF 생성 성공 후 경고 박스 표시 (Advisory Mode, 생성 차단 없음) |
| 경고 상태 기준 | `dangerCheck.hasDanger` 시 빨간 경고 박스, 아니면 표시 안 함 |

**반영 파일**: `app/admin/contracts/[id]/page.tsx`

---

### COMPANY_ADMIN 스코프 점검

| 점검 범위 | 결과 |
|-----------|------|
| /api/company/* 전 엔드포인트 (12개) | requireCompanyAdmin() + companyId 스코프 전부 정상 |
| ID 추측 접근 (attendance/[id], devices/[id]) | workerCompanyAssignment 소속 확인 후 403 차단 |
| /api/admin/* 접근 | middleware.ts에서 COMPANY_ADMIN 차단 |
| PDF/문서 생성 API | /api/admin/ 하위이므로 COMPANY_ADMIN 접근 불가 |

**누락 발견: 없음. 수정 항목: 없음.**

---

### bankAccount 레거시 구조 정리

| 항목 | 결과 |
|------|------|
| 레거시 필드 | Worker.bankName, Worker.bankAccount (평문, 마이그레이션 중) |
| 신규 구조 | WorkerBankAccountSecure (AES-256-GCM + 마스킹 + 해시) |
| 복호화 권한 | SUPER_ADMIN 전용 확인 ✓ |
| COMPANY_ADMIN 노출 경로 | 없음 ✓ |
| 즉시 수정 항목 | contracts/new/page.tsx — w.bankAccount 평문 fallback 제거 |
| 잔여 항목 | Worker 테이블 레거시 컬럼 물리 삭제 (별도 마이그레이션 필요) |

**반영 파일**: `app/admin/contracts/new/page.tsx`

---

### workerName 스냅샷

| 항목 | 결과 |
|------|------|
| 계약 저장 시 workerName 출처 | 계약 생성 시 worker.name (live DB) |
| PDF 생성 시 workerName 출처 (수정 전) | contract.worker.name (live DB — 재생성 시 새 이름 사용) |
| ContractVersion.snapshotJson | worker.name 포함 확인 (첫 생성 시 전체 contract 스냅샷) |
| 판단 | 스냅샷 반영 필요 — 계약 당시 이름 불변성 원칙 |
| 수정 내용 | 기존 snapshotJson 존재 시 snapshotJson.worker.name 우선 사용 |

**반영 파일**: `app/api/admin/contracts/[id]/generate-pdf/route.ts`

---

## 3. 실제 수정 내역

| 파일 | 수정 이유 | 영향 범위 |
|------|-----------|-----------|
| `app/admin/contracts/[id]/page.tsx` | 위험 문구 경고 UI 노출 | 일용직 계약서 PDF 생성 화면 |
| `app/api/admin/contracts/[id]/generate-pdf/route.ts` | workerName 스냅샷 불변성 | 계약서 PDF 재생성 경로 |
| `app/admin/contracts/new/page.tsx` | bankAccount 평문 fallback 제거 | 계약 신규 생성 화면 자동채움 |

---

## 4. 재검증 결과

| 항목 | 검증 방법 | 결과 |
|------|-----------|------|
| 권한 차단 (COMPANY_ADMIN) | 코드 직접 확인 (전 12개 API) | 정상 ✓ |
| 위험 문구 경고 UI | 코드 흐름 확인 (API → state → render) | 정상 ✓ |
| workerName 스냅샷 불변성 | 코드 흐름 확인 (snapshotJson 우선 조회) | 정상 ✓ |
| bankAccount 평문 노출 차단 | 코드 확인 (fallback 제거) | 정상 ✓ |

---

## 5. 잔여 리스크

| 항목 | 내용 | 다음 단계 |
|------|------|-----------|
| Worker 레거시 컬럼 물리 삭제 | bankName, bankAccount 컬럼이 DB에 잔존 | 전체 데이터 이행 후 별도 마이그레이션 |
| 레거시 근로자 계좌 이행 | bankAccount → WorkerBankAccountSecure 이행 스크립트 미작성 | 다음 스프린트 |
| 위험 문구 경고 범위 확장 | 현재 DAILY_EMPLOYMENT만 검사 | 필요 시 다른 계약 유형 확장 검토 |
| workerName 스냅샷 (generate-doc) | generate-doc 경로는 동일 수정 미적용 | generate-doc/route.ts도 동일 패턴 적용 필요 |

---

## 6. 최종 판정

**핵심 항목 대부분 완료, 일부 후속 필요**

- 위험 문구 경고 관리자 UI 노출: **완료**
- COMPANY_ADMIN 스코프 전수 점검: **이상 없음 확인**
- bankAccount 레거시 — 핵심 리스크 차단: **완료**, 컬럼 삭제는 후속
- workerName 스냅샷 반영: **완료 (generate-pdf)**
