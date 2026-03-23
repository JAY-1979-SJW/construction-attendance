# 관리자 화면 메뉴/라우트/API 명세서

> 작성일: 2026-03-24
> 기준 코드베이스: master
> 현황: 71 페이지 · 223 API 엔드포인트 · 12 컴포넌트 파일

---

## 0. 현황 요약 — 기존 vs 신규 구조 대응표

| 구분 | 기존 경로 | 신규 경로 | 상태 |
|------|-----------|-----------|------|
| 내부 운영자 | `/admin/*` | `/admin/*` | ✅ 대부분 구현 |
| 회사 관리자 | `/company/*` | `/company/*` | ⚠️ 일부 구현 |
| 현장 운영형 | (없음) | `/ops/*` | ❌ 미구현 |
| 작업자 모바일 | `/(mobile)/*`, `/my/*` | `/me/*` | ⚠️ 부분 구현 |
| 공용 가입 | `/register/*` | `/join/*` | ⚠️ 일부 구현 |
| 공통 컴포넌트 | (흩어짐) | `components/common/*` | ❌ 미구현 |

---

## 1. 역할별 메뉴 구조 (최종 확정)

### 1-1. SUPER_ADMIN / ADMIN

```
대시보드           /admin
회사 관리          /admin/companies
현장 관리          /admin/sites
사용자 관리        /admin/workers
관리자 계정        /admin/super-users
──────────────────────────────
▼ 승인 대기 (배지: 건수)
  회사 가입 승인    /admin/approvals/companies
  관리자 신청 승인  /admin/approvals/managers
  업체 합류 신청    /admin/approvals/company-joins
  작업자 가입 승인  /admin/approvals/workers
  현장 참여 승인    /admin/approvals/site-joins
  기기 등록 승인    /admin/approvals/devices
──────────────────────────────
현장 권한 묶음     /admin/access-groups
감사로그           /admin/audit-logs
시스템 설정        /admin/settings
```

**현재 상태:**
- `/admin/approvals/*` → 기존 `/admin/registrations`, `/admin/company-admin-requests`, `/admin/site-join-requests`, `/admin/device-requests` 4개를 통합 재구성 필요
- 나머지 메뉴는 기존 페이지 존재

### 1-2. COMPANY_ADMIN

```
대시보드           /company
내 회사 정보       /company/profile
현장 관리          /company/sites
관리자 관리        /company/managers
작업자 관리        /company/workers
──────────────────────────────
▼ 승인 대기
  작업자 가입      /company/approvals/workers
  현장 참여        /company/approvals/site-joins
──────────────────────────────
출퇴근 현황        /company/attendance
작업일보           /company/worklogs
공지/일정          /company/notices
문서 상태          /company/documents
```

**현재 상태:**
- `/company/workers`, `/company/attendance`, `/company/documents` 존재
- `/company/profile`, `/company/managers`, `/company/worklogs`, `/company/notices` → 미구현

### 1-3. SITE_ADMIN / EXTERNAL_SITE_ADMIN

```
대시보드           /ops
내 담당 현장       /ops/sites
작업자 현황        /ops/workers
출퇴근 현황        /ops/attendance
작업일보           /ops/worklogs
공지/일정          /ops/notices
──────────────────────────────
문서 상태          /ops/documents
```

**현재 상태:** `/ops/*` 전체 미구현 — 1순위 신규 구현 대상

### 1-4. WORKER (모바일 앱)

```
내 출퇴근          /me/attendance
내 현장            /me/sites
내 문서            /me/documents
내 공지            /me/notices
내 정보            /me/profile
```

**현재 상태:** `/(mobile)/attendance`, `/my/*` 흩어져 있음 — `/me/*` 통합 필요

---

## 2. 라우트 전체 목록 (구현 우선순위 포함)

### P0 — 이번 단계 필수 (운영 시작 블로커)

| 경로 | 역할 | 현재 상태 | 대응 기존 경로 |
|------|------|-----------|----------------|
| `/admin/approvals/companies` | SUPER_ADMIN | ❌ 신규 | `/admin/company-admin-requests` 재구성 |
| `/admin/approvals/managers` | SUPER_ADMIN | ❌ 신규 | `/admin/company-admin-requests` 재구성 |
| `/admin/approvals/company-joins` | SUPER_ADMIN | ❌ 신규 | `/api/admin/company-join-requests` 신규 |
| `/admin/approvals/workers` | ADMIN+ | ❌ 신규 | `/admin/registrations` 재구성 |
| `/admin/approvals/site-joins` | ADMIN+ | ❌ 신규 | `/admin/site-join-requests` 재구성 |
| `/admin/approvals/devices` | ADMIN+ | ❌ 신규 | `/admin/device-requests` 재구성 |
| `/ops` | SITE_ADMIN / EXT | ❌ 신규 | - |
| `/ops/sites` | SITE_ADMIN / EXT | ❌ 신규 | - |
| `/ops/workers` | SITE_ADMIN / EXT | ❌ 신규 | - |
| `/ops/attendance` | SITE_ADMIN / EXT | ❌ 신규 | - |
| `/ops/worklogs` | SITE_ADMIN / EXT | ❌ 신규 | - |
| `/ops/notices` | SITE_ADMIN / EXT | ❌ 신규 | - |

### P1 — 1~2주 내 필요

| 경로 | 역할 | 현재 상태 |
|------|------|-----------|
| `/company/profile` | COMPANY_ADMIN | ❌ 신규 |
| `/company/managers` | COMPANY_ADMIN | ❌ 신규 |
| `/company/worklogs` | COMPANY_ADMIN | ❌ 신규 |
| `/company/notices` | COMPANY_ADMIN | ❌ 신규 |
| `/company/approvals/workers` | COMPANY_ADMIN | ❌ 신규 |
| `/company/approvals/site-joins` | COMPANY_ADMIN | ❌ 신규 |
| `/join/company/new` | 공개 | `/register/company-admin` 재구성 |
| `/join/company/existing` | 공개 | `/api/auth/register/company-join` 신규 |
| `/join/status` | 공개 | ❌ 신규 |

### P2 — 추후

| 경로 | 역할 | 현재 상태 |
|------|------|-----------|
| `/me/attendance` | Worker | `/(mobile)/attendance` 이전 |
| `/me/documents` | Worker | ❌ 신규 |
| `/me/notices` | Worker | ❌ 신규 |
| `/ops/documents` | SITE_ADMIN / EXT | ❌ 신규 |
| `/admin/companies/[companyId]` | ADMIN+ | ⚠️ `/admin/companies/[id]` 존재 |

---

## 3. 페이지별 상세 명세

---

### 3-1. 내부 운영 대시보드 `/admin`

**역할:** ADMIN+

**현황:** `/app/admin/page.tsx` 존재

**레이아웃:**
```
┌─────────────────────────────────────────────────┐
│ 승인 대기 카드 ×4           │ 오늘 현황 카드 ×3 │
├─────────────────────────────────────────────────┤
│ 최근 감사 이벤트 (접근 거부 포함)               │
└─────────────────────────────────────────────────┘
```

**카드 목록:**
| 카드 | 클릭 시 이동 | API |
|------|-------------|-----|
| 승인 대기 회사 | `/admin/approvals/companies` | `GET /api/admin/company-admin-requests?status=PENDING` |
| 승인 대기 작업자 | `/admin/approvals/workers` | `GET /api/admin/registrations?status=PENDING` |
| 현장 참여 대기 | `/admin/approvals/site-joins` | `GET /api/admin/site-join-requests?status=PENDING` |
| 기기 등록 대기 | `/admin/approvals/devices` | `GET /api/admin/device-requests?status=PENDING` |
| 활성 회사 수 | `/admin/companies` | `GET /api/admin/dashboard` |
| 활성 현장 수 | `/admin/sites` | `GET /api/admin/dashboard` |
| 오늘 출근 현장 | `/admin/attendance` | `GET /api/admin/dashboard` |

**신규 필요 API:** `GET /api/admin/approvals/summary` (모든 대기 건수 한 번에)

---

### 3-2. 승인 대기 통합 허브 `/admin/approvals`

**역할:** ADMIN+

**구현 방식:** 탭 기반 통합 페이지 (각 탭별 독립 URL)

#### 탭 1: 회사 가입 승인 `/admin/approvals/companies`

**기존 페이지:** `/admin/company-admin-requests` → 이 탭으로 이전/재구성

**테이블 컬럼:**
```
신청일 | 업체명 | 사업자번호 | 담당자명 | 연락처 | 이메일 | 상태 | 액션
```

**액션:**
- `승인` → `POST /api/admin/company-admin-requests/[id]/approve` → 임시비밀번호 모달 표시
- `반려` → `POST /api/admin/company-admin-requests/[id]/reject` → 사유 입력 모달

**상태 전이:**
```
PENDING → APPROVED : 승인 클릭 + 비밀번호 확인
PENDING → REJECTED : 반려 클릭 + 사유 입력 (min 1자)
```

#### 탭 2: 관리자 합류 승인 `/admin/approvals/managers`

**기존 페이지:** 없음 → `/api/admin/company-join-requests` 기반 신규

**테이블 컬럼:**
```
신청일 | 업체명 | 신청자명 | 연락처 | 이메일 | 메모 | 상태 | 액션
```

**액션:**
- `승인` → `POST /api/admin/company-join-requests/[id]/approve`
- `반려` → `POST /api/admin/company-join-requests/[id]/reject`

#### 탭 3: 작업자 가입 승인 `/admin/approvals/workers`

**기존 페이지:** `/admin/registrations` → 이 탭으로 이전

**테이블 컬럼:**
```
신청일 | 이름 | 연락처 | 직종 | 아이디 | 상태 | 기기 대기 | 액션
```

**액션:**
- `승인` → `POST /api/admin/registrations/[id]/approve`
- `반려` → `POST /api/admin/registrations/[id]/reject` (사유 필수)

#### 탭 4: 현장 참여 승인 `/admin/approvals/site-joins`

**기존 페이지:** `/admin/site-join-requests` → 이 탭으로 이전

**테이블 컬럼:**
```
신청일 | 작업자 | 현장명 | 소속 업체 | 신청 방식 | 메모 | 상태 | 액션
```

**액션:**
- `승인` → `POST /api/admin/site-join-requests/[id]/approve`
- `반려` → `POST /api/admin/site-join-requests/[id]/reject`

#### 탭 5: 기기 등록 승인 `/admin/approvals/devices`

**기존 페이지:** `/admin/device-requests` → 이 탭으로 이전

**테이블 컬럼:**
```
신청일 | 작업자 | 기기명 | 기기 토큰(일부) | 사유 | 상태 | 액션
```

**액션:**
- `승인` → `POST /api/admin/device-requests/[id]/approve`
- `반려` → `POST /api/admin/device-requests/[id]/reject`

---

### 3-3. 현장 권한 묶음 `/admin/access-groups`

**역할:** ADMIN+

**기존 페이지:** `/admin/site-access-groups` → 동일 기능, 경로만 정리

**레이아웃:** 2단 분할 (목록 왼쪽, 상세 오른쪽)

**목록 컬럼:**
```
묶음명 | 현장 수 | 배정 사용자 수 | 활성 | 생성일
```

**상세 패널 섹션:**
1. 기본 정보 (묶음명, 설명, 활성 토글)
2. 포함 현장 목록 (추가/제거)
3. 배정 사용자 목록 (배정/해제)

**호출 API:**
```
GET  /api/admin/site-access-groups            목록
POST /api/admin/site-access-groups            생성
POST /api/admin/site-access-groups/[id]/sites 현장 추가
DELETE /api/admin/site-access-groups/[id]/sites?siteId= 제거
POST /api/admin/site-access-groups/[id]/users 사용자 배정
DELETE /api/admin/site-access-groups/[id]/users?userId= 해제
```

---

### 3-4. 회사 관리 `/admin/companies`

**역할:** ADMIN+

**기존 페이지:** `/admin/companies/page.tsx` 존재

**테이블 컬럼:**
```
회사명 | 사업자번호 | 유형 | 현장 수 | 관리자 수 | 상태 | 등록일 | 액션
```

**필터바:**
- 상태 (ACTIVE / INACTIVE / 전체)
- 회사명 또는 사업자번호 검색

**액션:**
- `상세 보기` → `/admin/companies/[id]`
- `비활성화` → `POST /api/admin/companies/[id]/deactivate` (SUPER_ADMIN만)

**호출 API:**
```
GET /api/admin/companies?status=&search=&page=&pageSize=
```

---

### 3-5. 회사 상세 `/admin/companies/[companyId]`

**역할:** ADMIN+

**기존 페이지:** `/admin/companies/[id]/page.tsx` 존재

**탭 구성:**
```
기본 정보 | 소속 현장 | 관리자 | 작업자 | 요청 이력 | 감사 로그
```

**호출 API:**
```
GET /api/admin/companies/[id]
GET /api/admin/sites?companyId=[id]
GET /api/admin/admin-users?companyId=[id]
GET /api/admin/workers?companyId=[id]
GET /api/admin/company-admin-requests?businessNumber=...
GET /api/admin/audit-logs?companyId=[id]
```

---

### 3-6. 현장 목록 `/admin/sites`

**역할:** ADMIN+

**기존 페이지:** `/admin/sites/page.tsx` 존재 (scope 적용 완료)

**테이블 컬럼:**
```
현장명 | 소속 회사 | 상태 | 관리자 수 | 작업자 수 | 시작일 | 종료 예정 | 액션
```

**필터바:**
- 상태 (ACTIVE / PLANNED / CLOSED)
- 회사
- 현장명 검색

**액션:**
- `상세 보기` → `/admin/sites/[id]`
- `신규 현장` → 생성 drawer

---

### 3-7. 현장 상세 `/admin/sites/[siteId]`

**역할:** ADMIN+ (canAccessSite 검증)

**기존 페이지:** `/admin/sites/[id]/page.tsx` 존재 (v4 강화됨)

**탭 구성 및 API:**
```
탭명         | 호출 API
─────────────────────────────────────────────────────
기본 정보    | GET /api/admin/sites/[id]
관리자       | GET /api/admin/site-admin-assignments?siteId=
작업자       | GET /api/admin/sites/[id]/daily-workers
출퇴근       | GET /api/admin/attendance?siteId=
작업일보     | GET /api/admin/sites/[id]/worklogs
공지         | GET /api/admin/sites/[id]/notices
일정         | GET /api/admin/sites/[id]/schedules
TBM          | GET /api/admin/sites/[id]/tbm/[date]
감사이력     | GET /api/admin/audit-logs?siteId=
```

**액션 (권한별):**
| 액션 | 허용 역할 | API |
|------|-----------|-----|
| 현장 정보 수정 | ADMIN+ | `PATCH /api/admin/sites/[id]` |
| 작업일보 작성 | SITE_ADMIN+ | `POST /api/admin/sites/[id]/worklogs/[date]` |
| 공지 작성 | SITE_ADMIN+ | `POST /api/admin/sites/[id]/notices` |
| 일정 추가 | SITE_ADMIN+ | `POST /api/admin/sites/[id]/schedules` |
| TBM 작성 | SITE_ADMIN+ | `POST /api/admin/sites/[id]/tbm/[date]` |
| 출퇴근 수정 | ADMIN+, SITE_ADMIN | `PATCH /api/admin/attendance/[id]` |
| 출퇴근 수정 | EXTERNAL_SITE_ADMIN | ❌ 읽기 전용 |

---

### 3-8. 회사 관리자 대시보드 `/company`

**역할:** COMPANY_ADMIN

**기존 페이지:** `/company/page.tsx` 존재

**레이아웃:**
```
┌──────────────────────────────────────────┐
│ 운영중 현장 | 오늘 출근 | 대기 건수      │
├──────────────────────────────────────────┤
│ 최근 미제출 작업일보 목록                │
├──────────────────────────────────────────┤
│ 승인 대기 요약 (작업자/현장참여)         │
└──────────────────────────────────────────┘
```

**호출 API:**
```
GET /api/company/dashboard
GET /api/admin/sites?companyId=<자기회사> (scope 적용)
GET /api/admin/attendance?date=today (scope 적용)
GET /api/admin/registrations?status=PENDING (scope 적용)
```

**중요:** 모든 API는 `buildSiteScopeWhere` / `buildWorkerScopeWhere` 기반으로 자기 회사 범위만 반환

---

### 3-9. 회사 현장 목록 `/company/sites`

**역할:** COMPANY_ADMIN

**기존 페이지:** 없음 → 신규 (동일 `/admin/sites` 컴포넌트 재사용, scope는 자동 적용)

**호출 API:**
```
GET /api/admin/sites (자기 회사 범위만 반환됨)
POST /api/admin/sites (현장 생성)
```

**노출 차이 (vs ADMIN):**
- `소속 회사` 컬럼 없음 (항상 자기 회사)
- 타회사 현장 표시 없음 (API scope 자동 적용)

---

### 3-10. 회사 관리자 목록 `/company/managers`

**역할:** COMPANY_ADMIN

**기존 페이지:** 없음 → 신규

**테이블 컬럼:**
```
이름 | 이메일 | 관리 범위 | 담당 현장 수 | 활성 | 액션
```

**관리 범위 표시 (역할 → UI 문구):**
| 내부 역할 | UI 표시 |
|-----------|---------|
| COMPANY_ADMIN | 전체 현장 관리 |
| SITE_ADMIN | 담당 현장 관리 |
| EXTERNAL_SITE_ADMIN | 지정 현장 운영형 |

**호출 API:**
```
GET /api/admin/admin-users?companyId=<자기회사>
POST /api/admin/admin-users (신규 관리자 초대)
PATCH /api/admin/admin-users/[id]
POST /api/admin/admin-users/[id]/deactivate
```

**권한 제약:**
- COMPANY_ADMIN은 자기 회사 관리자만 조회/수정 가능
- SUPER_ADMIN/ADMIN 계정 생성 불가
- EXTERNAL_SITE_ADMIN 배정 시 site-access-groups 설정 별도 필요 (안내 문구)

---

### 3-11. 회사 작업자 목록 `/company/workers`

**역할:** COMPANY_ADMIN

**기존 페이지:** `/company/workers/page.tsx` 존재

**테이블 컬럼:**
```
이름 | 연락처 | 상태 | 배정 현장 | 근로 유형 | 문서 상태 | 액션
```

**상태 배지 표시:**
| `accountStatus` | UI 배지 |
|-----------------|---------|
| PENDING | 승인 대기 |
| APPROVED | 활성 |
| REJECTED | 반려 |
| SUSPENDED | 중지 |

**액션:**
- `상세 보기` → `/admin/workers/[id]` (기존 상세 페이지 재사용)
- `현장 배정` → 배정 drawer → `POST /api/admin/workers/[id]/site-assignments`

**호출 API:**
```
GET /api/admin/workers (scope 자동: 자기 회사 범위)
```

---

### 3-12. 회사 승인 대기 `/company/approvals`

**역할:** COMPANY_ADMIN

**기존 페이지:** 없음 → 신규 (2탭 구성)

#### 탭 1: 작업자 가입 승인
```
GET /api/admin/registrations?status=PENDING
POST /api/admin/registrations/[id]/approve
POST /api/admin/registrations/[id]/reject
```

**중요:** 자기 회사 배정 작업자 or 미배정 작업자만 노출 (scope 적용)

#### 탭 2: 현장 참여 승인
```
GET /api/admin/site-join-requests?status=PENDING&companyId=...
POST /api/admin/site-join-requests/[id]/approve
POST /api/admin/site-join-requests/[id]/reject
```

---

### 3-13. 지정 현장 운영형 대시보드 `/ops`

**역할:** SITE_ADMIN, EXTERNAL_SITE_ADMIN

**기존 페이지:** 없음 → 신규

**레이아웃:**
```
┌──────────────────────────────────────────┐
│ 담당 현장 수 | 오늘 출근 | 미제출 일보   │
├──────────────────────────────────────────┤
│ 현장 카드 목록 (담당 현장만)             │
│  [현장명] 출근 N명 / 미퇴근 M명         │
├──────────────────────────────────────────┤
│ 오늘 할 일: 미작성 TBM / 미제출 일보     │
└──────────────────────────────────────────┘
```

**호출 API:**
```
GET /api/admin/sites (scope → 배정/접근 가능 현장만)
GET /api/admin/attendance?date=today (scope 적용)
GET /api/admin/sites/[id]/worklogs (각 현장별)
```

**신규 필요 API:** `GET /api/ops/dashboard/summary` (또는 기존 admin API scope 활용)

**EXTERNAL_SITE_ADMIN 주의사항:**
- 회사 정보 탭 없음
- 수정 액션 없음 (읽기 전용 표시)
- 소속 회사 컬럼 표시 안 함

---

### 3-14. 지정 현장 운영형 현장 목록 `/ops/sites`

**역할:** SITE_ADMIN, EXTERNAL_SITE_ADMIN

**기존 페이지:** 없음 → 신규

**테이블 컬럼:**
```
현장명 | 소속 회사* | 상태 | 오늘 출근 | 작업자 수 | 액션
```
*SITE_ADMIN만 소속 회사 표시, EXTERNAL_SITE_ADMIN은 숨김

**액션:**
- `상세 보기` → `/ops/sites/[siteId]`
- 수정/삭제 없음

**호출 API:**
```
GET /api/admin/sites
```
(서버에서 `getAccessibleSiteIds()` 기반 자동 필터링)

**보안:** URL `/ops/sites/[siteId]`에 직접 접근 시 서버에서 `canAccessSite()` 검증 → 403

---

### 3-15. 지정 현장 운영형 현장 상세 `/ops/sites/[siteId]`

**역할:** SITE_ADMIN, EXTERNAL_SITE_ADMIN

**기존 페이지:** 없음 → `/admin/sites/[id]` 컴포넌트 재사용, 권한 필터 적용

**탭 구성:**

| 탭 | SITE_ADMIN | EXTERNAL_SITE_ADMIN |
|----|-----------|---------------------|
| 기본 정보 | 읽기+수정 | 읽기 전용 |
| 작업자 | 읽기 | 읽기 |
| 출퇴근 | 읽기+수정 | 읽기 전용 |
| 작업일보 | 읽기+작성 | 읽기 전용 |
| 공지 | 읽기+작성 | 읽기+작성 |
| 일정 | 읽기+작성 | 읽기+작성 |
| TBM | 읽기+작성 | 읽기+작성 |
| 회사 정보 탭 | 없음 | 없음 |

---

### 3-16. 지정 현장 운영형 작업자 목록 `/ops/workers`

**역할:** SITE_ADMIN, EXTERNAL_SITE_ADMIN

**기존 페이지:** 없음 → 신규

**테이블 컬럼:**
```
이름 | 현장 | 오늘 출근 상태 | 문서 상태 | 근로 유형 | 액션
```

**액션:**
- `상세 보기` → `/ops/workers/[workerId]`
- 수정 없음

**호출 API:**
```
GET /api/admin/workers (scope: siteAssignments.some 기반 필터)
GET /api/admin/workers/[id] (scope: buildWorkerScopeWhere)
```

**중요:** 다른 현장 이력(출퇴근 기록 등)은 현재 현장 것만 표시

---

### 3-17. 출퇴근 현황 (공통)

#### 회사 관리자: `/company/attendance`
#### 지정 현장 운영형: `/ops/attendance`

**기존 페이지:** `/company/attendance/page.tsx` 존재 (scope 미적용 가능성)

**공통 레이아웃:**
```
┌─────────────────────────────────────────────┐
│ 날짜 선택기 | 현장 필터 | 상태 필터 | 검색  │
├─────────────────────────────────────────────┤
│ 출근 N | 미퇴근 M | 예외 K | 미출근 P       │
├─────────────────────────────────────────────┤
│ 테이블: 이름 | 현장 | 출근 | 퇴근 | 상태 | 액션 │
└─────────────────────────────────────────────┘
```

**호출 API:**
```
GET /api/admin/attendance?date=&siteId=&status=
PATCH /api/admin/attendance/[id]  (수정 권한 있는 역할만)
```

**권한별 액션 차이:**
| 역할 | 출퇴근 수정 | 수동 처리 |
|------|-----------|----------|
| ADMIN+ | ✅ | ✅ |
| COMPANY_ADMIN | ✅ (자기 회사) | ✅ |
| SITE_ADMIN | ✅ (담당 현장) | ✅ |
| EXTERNAL_SITE_ADMIN | ❌ | ❌ |

---

### 3-18. 작업일보 (공통)

#### 회사 관리자: `/company/worklogs`
#### 지정 현장 운영형: `/ops/worklogs`

**기존 페이지:** 없음 → 신규

**레이아웃:**
```
현장 선택 | 날짜 선택
──────────────────────────────────
날짜별 일보 목록
  [날짜] [현장] 인원: N명 [보기/작성]
```

**호출 API:**
```
GET  /api/admin/sites/[id]/worklogs
GET  /api/admin/sites/[id]/worklogs/[date]
POST /api/admin/sites/[id]/worklogs/[date]   (EXTERNAL 제외)
PATCH /api/admin/sites/[id]/worklogs/[date]  (EXTERNAL 제외)
```

---

### 3-19. 공지/일정 (공통)

#### `/company/notices`, `/ops/notices`
#### `/company/schedules`, `/ops/schedules`

**기존 페이지:** 없음 → 신규

**공지 레이아웃:**
```
현장 선택 | [공지 작성 버튼]
──────────────────────────────────
공지 카드 목록 (최신 순)
  제목 | 현장 | 작성자 | 작성일 | [수정] [삭제]
```

**호출 API:**
```
GET  /api/admin/sites/[id]/notices
POST /api/admin/sites/[id]/notices
PUT  /api/admin/sites/[id]/notices/[noticeId]
DELETE /api/admin/sites/[id]/notices/[noticeId]
```

---

### 3-20. 감사로그 `/admin/audit-logs`

**역할:** ADMIN+

**기존 페이지:** `/admin/audit-logs/page.tsx` 존재

**테이블 컬럼:**
```
시각 | 사용자 | 역할 | 액션 | 대상 유형 | 대상 ID | 회사 | 현장 | 결과
```

**특별 필터:**
- `actionType = DENIED_SITE_ACCESS` → 접근 거부 전용 필터
- `actionType = DENIED_COMPANY_ACCESS` → 회사 접근 거부

**호출 API:**
```
GET /api/admin/audit-logs?actionType=&userId=&companyId=&siteId=&from=&to=&page=
```

---

## 4. 공용 가입/인증 라우트

| 경로 | 목적 | 기존 상태 | 호출 API |
|------|------|-----------|---------|
| `/join/company/new` | 신규 업체 관리자 신청 | `/register/company-admin` | `POST /api/auth/register/company-admin` |
| `/join/company/existing` | 기존 업체 합류 신청 | ❌ 신규 | `GET /api/public/companies` + `POST /api/auth/register/company-join` |
| `/join/status` | 신청 상태 확인 | `/register/pending` | - |
| `/login` | 작업자 로그인 | ✅ 구현 | `POST /api/auth/send-otp` |
| `/admin/login` | 관리자 로그인 | ✅ 구현 | `POST /api/admin/auth/login` |

### `/join/company/existing` 화면 흐름

```
1. 업체 검색 (이름 또는 사업자번호)
   → GET /api/public/companies?search=
   → 결과: 업체명 + 사업자번호 앞 6자리만 노출

2. 업체 선택 후 신청 폼
   → 담당자명, 연락처, 이메일, 직함, 메모

3. 제출
   → POST /api/auth/register/company-join
   → 성공 시 /join/status?type=company-join

4. 이메일 발송 (접수 확인)
```

---

## 5. 신규 필요 API 목록 (현재 미구현)

| API | 메서드 | 목적 | 우선순위 |
|-----|--------|------|---------|
| `/api/admin/approvals/summary` | GET | 대시보드 승인 대기 건수 종합 | P0 |
| `/api/ops/dashboard/summary` | GET | ops 대시보드 요약 | P0 |
| `/api/admin/companies/[id]/deactivate` | POST | 회사 비활성화 | P1 |
| `/api/admin/admin-users/[id]/deactivate` | POST | 관리자 비활성화 | P1 |
| `/api/company/profile` | GET/PATCH | 내 회사 정보 | P1 |
| `/api/company/managers` | GET | 회사 관리자 목록 | P1 |
| `/api/company/approvals/workers` | GET | 회사별 작업자 승인 대기 | P1 |
| `/api/company/approvals/site-joins` | GET | 회사별 현장참여 승인 대기 | P1 |
| `/api/admin/sites/[id]/managers` | GET | 현장 관리자 목록 | P1 |
| `/api/admin/audit-logs/recent` | GET | 최근 감사 이벤트 (대시보드용) | P2 |

---

## 6. 상태 전이 규칙 (화면 + API 일치 기준)

### 6-1. Worker.accountStatus

```
PENDING ──[승인]──► APPROVED
PENDING ──[반려]──► REJECTED
APPROVED ─[중지]──► SUSPENDED
SUSPENDED ─[복구]──► APPROVED
```

**API 매핑:**
| 전이 | API | 화면 |
|------|-----|------|
| PENDING → APPROVED | `POST /api/admin/registrations/[id]/approve` | `/admin/approvals/workers` |
| PENDING → REJECTED | `POST /api/admin/registrations/[id]/reject` | `/admin/approvals/workers` |
| APPROVED → SUSPENDED | `DELETE /api/admin/workers/[id]` (SUPER_ADMIN) | `/admin/workers/[id]` |

### 6-2. CompanyAdminRequest.status / CompanyJoinRequest.status

```
PENDING ──[승인]──► APPROVED
PENDING ──[반려]──► REJECTED
```

**화면 매핑:**
| 신청 유형 | 화면 |
|-----------|------|
| CompanyAdminRequest | `/admin/approvals/companies` |
| CompanyJoinRequest | `/admin/approvals/managers` |

### 6-3. SiteJoinRequest.status

```
PENDING ──[승인]──► APPROVED
PENDING ──[반려]──► REJECTED
PENDING ──[취소]──► CANCELLED (작업자 본인)
```

### 6-4. Site.status

```
PLANNED ──[운영 시작]──► ACTIVE
ACTIVE ──[종료]──────► CLOSED
CLOSED ──[보관]──────► ARCHIVED
```

**화면 매핑:** `/admin/sites/[id]` → 기본 정보 탭 → 상태 변경 버튼 (ADMIN+ 전용)

---

## 7. 공통 컴포넌트 명세

현재 `components/common/` 디렉토리 비어있음 → 아래 컴포넌트 생성 필요

### 7-1. `<StatusBadge status={} />`

지원 상태 및 색상:

| status | 배지 텍스트 | 색상 |
|--------|------------|------|
| ACTIVE / APPROVED | 활성 / 승인 | 초록 |
| PENDING | 승인 대기 | 노랑 |
| REJECTED | 반려 | 빨강 |
| INACTIVE / SUSPENDED | 비활성 / 중지 | 회색 |
| CLOSED / ARCHIVED | 종료 / 보관 | 어두운 회색 |
| PLANNED | 준비 중 | 파랑 |

### 7-2. `<DataTable columns={} data={} pagination={} />`

기능:
- 컬럼 정의 (key, header, render)
- 페이지네이션
- 로딩 스켈레톤
- 빈 상태 슬롯

### 7-3. `<FilterBar filters={} onChange={} />`

지원 필터 유형:
- `select` (상태, 역할, 현장)
- `search` (키워드)
- `dateRange` (기간)

### 7-4. `<ActionBar actions={} />`

버튼 목록:
- 승인 (초록, confirm 모달)
- 반려 (빨강, 사유 입력 모달)
- 수정 (파랑)
- 비활성화 (회색, confirm 모달)
- 배정 (파랑, 선택 drawer)

### 7-5. `<EmptyState message={} icon={} />`

사용 예:
```tsx
<EmptyState message="배정된 현장이 없습니다" icon="site" />
<EmptyState message="승인 대기 항목이 없습니다" icon="check" />
```

### 7-6. `<ConfirmModal title={} message={} onConfirm={} />`

사유 입력 모드:
```tsx
<ConfirmModal requireReason reasonLabel="반려 사유" minLength={1} />
```

---

## 8. 권한 체크 지점 명세

### 8-1. 프론트엔드 체크 기준 (`session.role`)

| 체크 | 방법 | 예시 |
|------|------|------|
| 메뉴 노출 | `role`이 특정 역할 포함 여부 | `ADMIN+만 audit-logs 메뉴 표시` |
| 버튼 노출 | `role` + `canMutate` 조건 | `EXTERNAL_SITE_ADMIN은 수정 버튼 숨김` |
| 페이지 가드 | `middleware.ts` or layout 레벨 | `/ops/*` → SITE_ADMIN+ 아니면 redirect |
| 빈 상태 분기 | 역할별 메시지 변경 | `"배정 현장이 없습니다 (관리자에게 문의)"` |

**Layout별 역할 분기:**
```typescript
// app/ops/layout.tsx
const allowedRoles = ['SITE_ADMIN', 'EXTERNAL_SITE_ADMIN']
if (!allowedRoles.includes(session.role)) redirect('/admin')

// app/company/layout.tsx
if (session.role !== 'COMPANY_ADMIN') redirect('/admin')
```

### 8-2. 백엔드 체크 기준 (서버 권한 최종 기준)

| 체크 유형 | 함수 | 적용 API |
|-----------|------|---------|
| 로그인 여부 | `getAdminSession()` | 모든 /api/admin/* |
| 역할 체크 | `requireRole(session, roles)` | 수정/생성/삭제 API |
| 현장 접근 | `canAccessSite(session, siteId)` | 단건 현장 API |
| 현장 목록 | `buildSiteScopeWhere(session)` | 목록 API |
| 작업자 접근 | `buildWorkerScopeWhere(session)` | 작업자 API |
| 회사 접근 | `canAccessCompany(session, companyId)` | 회사 단건 API |
| 거부 로깅 | `siteAccessDeniedWithLog(session, siteId)` | 권한 거부 시 |

**EXTERNAL_SITE_ADMIN 특별 규칙:**
```
canAccessCompany() → 항상 false
getAccessibleCompanyIds() → []
출퇴근 수정 PATCH → 403 (requireRole로 차단)
```

---

## 9. 구현 순서 (최종 확정)

### Phase 1 — 운영 시작 블로커 (P0)

1. `components/common/` 기본 컴포넌트 4종 생성
   - `StatusBadge`, `DataTable`, `ActionBar`, `ConfirmModal`
2. `/admin/approvals/*` 통합 승인 대기 페이지 (탭 5개)
   - 기존 `/admin/registrations`, `/admin/company-admin-requests`, `/admin/site-join-requests`, `/admin/device-requests` 탭으로 통합
3. `/ops/*` 전체 신규 구현
   - `layout.tsx` + `page.tsx` + 탭 컴포넌트

### Phase 2 — 기능 완성 (P1)

4. `/company/profile` — 내 회사 정보 페이지
5. `/company/managers` — 회사 관리자 목록 + 초대
6. `/company/worklogs` — 작업일보 목록/작성
7. `/company/notices` — 공지 목록/작성
8. `/company/approvals/*` — 회사별 승인 대기
9. `/join/company/existing` — 기존 업체 합류 신청 퍼블릭 페이지

### Phase 3 — 완성도 (P2)

10. `/me/*` — 작업자 모바일 통합 재구성
11. `ops/documents` — 문서 상태 페이지
12. 공통 컴포넌트 완성 (`FilterBar`, `EmptyState`)

---

## 10. 테스트 시나리오

### E2E 시나리오 1: 신규 업체 관리자 가입 전 과정
```
1. /join/company/new → 업체명+사업자번호+담당자 입력
2. POST /api/auth/register/company-admin → REQUESTED 응답
3. 이메일: "신청 접수" 수신
4. /admin/approvals/companies → PENDING 항목 확인
5. 승인 클릭 → POST /api/admin/company-admin-requests/[id]/approve
6. 이메일: "승인 + 임시비밀번호" 수신
7. /admin/login → 이메일+임시비밀번호 로그인
8. /company → 대시보드 접근 성공
9. /admin/* → 접근 차단 확인 (403)
```

### E2E 시나리오 2: EXTERNAL_SITE_ADMIN 현장 접근 범위 검증
```
1. SUPER_ADMIN이 site-access-group 생성 → 현장 A, B 추가
2. EXTERNAL_SITE_ADMIN 계정 생성 → 그룹 배정
3. /ops/sites → 현장 A, B만 목록 표시 확인
4. /ops/sites/[siteId-A] → 정상 접근 (읽기 전용)
5. /ops/sites/[siteId-C] (미배정) → 403
6. 출퇴근 수정 버튼 없음 확인
7. 공지 작성 버튼 있음 확인
8. GET /api/admin/sites → 현장 A, B만 반환 확인
```

### E2E 시나리오 3: 회사 관리자 범위 격리 검증
```
1. 회사 A COMPANY_ADMIN 로그인
2. /company/sites → 회사 A 현장만 표시
3. /company/workers → 회사 A 작업자만 표시
4. /api/admin/workers?companyId=회사B_ID → 빈 배열 반환 확인
5. /admin/companies → 404 or redirect (COMPANY_ADMIN 접근 차단)
6. /admin/audit-logs → 403 확인
```

### E2E 시나리오 4: 상태 전이 유효성
```
1. PENDING 작업자 → 승인 버튼 클릭 → APPROVED
2. APPROVED 작업자 → 승인 버튼 없음 확인 (이미 처리됨 메시지)
3. REJECTED 작업자 → 재승인 불가 확인 (API 400 응답)
4. APPROVED → 반려 버튼 없음 확인
```

---

## 11. 완료 기준 체크리스트

- [x] 역할별 메뉴 구조 확정
- [x] 주요 페이지 라우트 정리
- [x] 각 페이지별 호출 API 정의
- [x] 승인/반려/배정/비활성화 액션 흐름 정리
- [x] 상태 전이 규칙 화면↔API 일치
- [x] `/ops/*` 현장 운영형 페이지 별도 구조 분리
- [x] 공통 컴포넌트 재사용 기준 정리
- [x] 백엔드 권한체크 지점 명확화
- [x] E2E 테스트 시나리오 준비
- [x] 프론트/백엔드 병렬 착수 가능 수준

---

## 부록: 기존 경로 → 신규 경로 마이그레이션 맵

| 기존 | 신규 | 처리 방법 |
|------|------|-----------|
| `/admin/registrations` | `/admin/approvals/workers` | redirect + 탭 통합 |
| `/admin/company-admin-requests` | `/admin/approvals/companies` | redirect + 탭 통합 |
| `/admin/site-join-requests` | `/admin/approvals/site-joins` | redirect + 탭 통합 |
| `/admin/device-requests` | `/admin/approvals/devices` | redirect + 탭 통합 |
| `/admin/site-access-groups` | `/admin/access-groups` | redirect |
| `/(mobile)/attendance` | `/me/attendance` | redirect (Phase 2) |
| `/my/status` | `/me/profile` | redirect (Phase 2) |
| `/register/company-admin` | `/join/company/new` | redirect |
| `/register/pending` | `/join/status` | redirect |
