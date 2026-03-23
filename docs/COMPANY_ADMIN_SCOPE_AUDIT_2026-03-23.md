# COMPANY_ADMIN API 스코프 전수 점검표 (2026-03-23)

## 점검 기준
- `requireCompanyAdmin()` 호출 여부 (인증 레이어)
- `session.companyId` 기반 쿼리 필터 여부 (데이터 격리 레이어)
- 단순 프론트 필터가 아닌 서버 쿼리 레벨에서 강제되는지
- 타 업체 데이터를 ID 추측으로 접근 가능한지
- SUPER_ADMIN 예외 경로와 분리되는지

## 전수 점검 결과

| API 경로 | 메서드 | 기능 | requireCompanyAdmin | companyId 스코프 강제 | 타사 접근 차단 | 문제 | 판정 |
|----------|--------|------|--------------------|--------------------|--------------|------|------|
| /api/company/dashboard | GET | 대시보드 통계 | ✓ | workerCompanyAssignment.companyId | ✓ | 없음 | **PASS** |
| /api/company/workers | GET | 근로자 목록 | ✓ | workerCompanyAssignment.companyId | ✓ | 없음 | **PASS** |
| /api/company/workers | POST | 근로자 신규 등록 | ✓ | 생성 시 session.companyId 자동 배정 | ✓ | 없음 | **PASS** |
| /api/company/attendance | GET | 출퇴근 목록 | ✓ | workerCompanyAssignment.companyId | ✓ | 없음 | **PASS** |
| /api/company/attendance/[id] | GET | 출퇴근 상세 | ✓ | workerCompanyAssignment 소속 확인 후 403 | ✓ | 없음 | **PASS** |
| /api/company/attendance/[id] | PATCH | 공수 수정 | ✓ | workerCompanyAssignment 소속 확인 후 403 | ✓ | 없음 | **PASS** |
| /api/company/documents | GET | 노임서류 조회 | ✓ | laborCostSummary.companyId + workerIds | ✓ | 없음 | **PASS** |
| /api/company/payroll | GET | 급여 집계 | ✓ | workerCompanyAssignment.companyId | ✓ | 없음 | **PASS** |
| /api/company/insurance | GET | 4대보험 현황 | ✓ | workerCompanyAssignment.companyId | ✓ | 없음 | **PASS** |
| /api/company/devices | GET | 기기 요청 목록 | ✓ | workerCompanyAssignment.companyId | ✓ | 없음 | **PASS** |
| /api/company/devices/[id] | PATCH | 기기 승인/거절 | ✓ | workerCompanyAssignment 소속 확인 후 403 | ✓ | 없음 | **PASS** |
| /api/company/auth/logout | POST | 로그아웃 | N/A | N/A | N/A | 없음 | **PASS** |

## 미들웨어 레벨 차단 확인

`middleware.ts` 검증 결과:
- COMPANY_ADMIN이 `/admin` 또는 `/api/admin/*` 경로 접근 시 → `/company`로 리다이렉트
- COMPANY_ADMIN이 `/api/admin/*` API 호출 시 → 미들웨어에서 차단 (admin_token 유효하더라도)
- 계약 생성(`POST /api/admin/contracts`), PDF 생성, 문서 생성 등 모든 플랫폼 관리자 API → COMPANY_ADMIN 접근 불가

## 판정

**COMPANY_ADMIN 스코프 누락 없음.**

- 12개 전 엔드포인트 서버 쿼리 레벨 companyId 강제 적용 확인
- ID 추측 접근(`/api/company/attendance/[id]`, `/api/company/devices/[id]`)도 소속 확인 후 403 차단
- SUPER_ADMIN 전용 기능(계좌 복호화, 계약 생성 등)은 /api/admin/ 하위 → COMPANY_ADMIN 접근 불가

**수정 항목: 없음**
