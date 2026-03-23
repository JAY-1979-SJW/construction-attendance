# Site Scope 접근 권한 매트릭스 및 적용 현황

> 작성일: 2026-03-24
> 기준 브랜치: master

---

## 1. 역할별 접근 매트릭스

| 기능 | SUPER_ADMIN / ADMIN | COMPANY_ADMIN | SITE_ADMIN (담당 현장 관리) | EXTERNAL_SITE_ADMIN (지정 현장 운영형) | WORKER |
|------|:---:|:---:|:---:|:---:|:---:|
| 전체 회사 목록 조회 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 자기 회사 정보 조회 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 전체 현장 목록 조회 | ✅ | 자기 회사만 | 배정 현장만 | 그룹 내 현장만 | ❌ |
| 배정 현장 출근 목록 조회 | ✅ | 자기 회사만 | ✅ | ✅ | 본인만 |
| 배정 현장 출근 상세/수정 | ✅ | 자기 회사만 | ✅ | ❌ (읽기 전용) | ❌ |
| 타회사 미배정 현장 조회 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 같은 회사 미배정 현장 조회 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 배정 현장 작업자 목록 | ✅ | 자기 회사만 | ✅ | ✅ | ❌ |
| 배정 현장 작업자 상세 | ✅ | 자기 회사만 | ✅ | ✅ | 본인만 |
| 작업자 수정 | ✅ | 자기 회사만 | ❌ | ❌ | ❌ |
| 배정 현장 작업일보 목록/상세 | ✅ | 자기 회사만 | ✅ | ✅ | ❌ |
| 배정 현장 작업일보 수정 | ✅ | 자기 회사만 | ✅ | ❌ | ❌ |
| 배정 현장 TBM 조회/작성 | ✅ | 자기 회사만 | ✅ | ✅ | ❌ |
| 배정 현장 공지 조회/작성 | ✅ | 자기 회사만 | ✅ | ✅ | ❌ |
| 배정 현장 일정 조회/작성 | ✅ | 자기 회사만 | ✅ | ✅ | ❌ |
| 배정 현장 출근자 상세 | ✅ | 자기 회사만 | ✅ | ✅ | ❌ |
| 체류 확인(presence check) | ✅ | 자기 회사만 | ✅ | ✅ | 본인만 |
| 계약/문서 생성 | ✅ | 자기 회사만 | ❌ | ❌ | ❌ |
| 보험/급여 데이터 | ✅ | 자기 회사만 | ❌ | ❌ | ❌ |
| 감사로그 조회 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 관리자 계정 생성/수정 | SUPER_ADMIN만 | ❌ | ❌ | ❌ | ❌ |

---

## 2. site scope 적용 현황

### ✅ 완료 — 적용됨

| 경로 | 방식 | 적용 함수 |
|------|------|-----------|
| `GET /api/admin/sites` | 목록 | `getAccessibleSiteIds()` |
| `GET /api/admin/sites/[id]` | 단건 | `canAccessSite()` |
| `PATCH /api/admin/sites/[id]` | 수정 | `canAccessSite()` |
| `GET /api/admin/sites/[id]/worklogs` | 목록 | `canAccessSite()` |
| `PATCH /api/admin/sites/[id]/worklogs/[date]` | 수정 | `canAccessSite()` |
| `GET /api/admin/sites/[id]/tbm/[date]` | 단건 | `canAccessSite()` |
| `POST /api/admin/sites/[id]/tbm/[date]` | 생성 | `canAccessSite()` |
| `GET /api/admin/sites/[id]/daily-workers` | 목록 | `canAccessSite()` |
| `GET /api/admin/sites/[id]/notices` | 목록 | `canAccessSite()` |
| `POST /api/admin/sites/[id]/notices` | 생성 | `canAccessSite()` |
| `GET /api/admin/sites/[id]/schedules` | 목록 | `canAccessSite()` |
| `POST /api/admin/sites/[id]/schedules` | 생성 | `canAccessSite()` |
| `GET /api/admin/attendance` | 목록 | `buildSiteScopeWhere()` + `canAccessSite()` |
| `GET /api/admin/attendance/[id]` | 단건 | `canAccessSite()` (fetch 후 검증) |
| `PATCH /api/admin/attendance/[id]` | 수정 | `canAccessSite()` (fetch 후 검증) |
| `GET /api/admin/workers` | 목록 | `buildWorkerScopeWhere()` |
| `GET /api/admin/workers/[id]` | 단건 | `buildWorkerScopeWhere()` (where 조건 포함) |
| `PUT /api/admin/workers/[id]` | 수정 | `buildWorkerScopeWhere()` (where 조건 포함) |
| `GET /api/admin/presence-checks` | 목록 | `buildSiteScopeWhere()` + `canAccessSite()` |

### ⚠️ 미적용 — 추후 처리 필요

| 경로 | 위험도 | 비고 |
|------|--------|------|
| `GET /api/admin/attendance/exceptions` | 중 | 이미 `SUPER_ADMIN/ADMIN` 전용으로 역할 제한됨. SITE_ADMIN 접근 시 scope 미적용 |
| `GET /api/admin/contracts` | 높음 | siteId 파라미터 허용하나 접근 검증 없음 |
| `GET /api/admin/contracts/[id]` | 높음 | 단건 조회 시 site 범위 검증 없음 |
| `GET /api/admin/presence-checks/[id]/confirm` | 중 | 단건 액션 시 site 검증 없음 |
| `GET /api/admin/dashboard` | 중 | 플랫폼 전체 통계 — ADMIN 전용 역할 제한 필요 |
| `GET /api/admin/wage-calculations` | 높음 | 전체 급여 데이터 무필터 |
| `GET /api/admin/document-center` | 중 | siteId 파라미터 허용하나 검증 없음 |
| `POST /api/export/attendance` | 높음 | siteId 파라미터 허용하나 검증 없음 |
| `POST /api/export/labor` | 높음 | siteId 파라미터 허용하나 검증 없음 |
| `GET /api/admin/labor-cost-summaries` | 중 | monthKey만 필터 |
| `GET /api/admin/retirement-mutual/workers` | 중 | 전체 조회 |
| `GET /api/admin/devices` | 낮음 | 장치 목록 — workerId 파라미터만 |
| `GET /api/admin/workers/[id]/bank` | 높음 | 계좌 정보 — SUPER_ADMIN 전용 역할 제한 필요 |

### 🔵 해당 없음 — scope 적용 불필요

| 경로 | 이유 |
|------|------|
| `GET /api/admin/companies` | company 목록 — SUPER_ADMIN/ADMIN 전용 |
| `GET /api/admin/admin-users` | 관리자 목록 — SUPER_ADMIN 전용 |
| `GET /api/admin/audit-logs` | 감사로그 — SUPER_ADMIN/ADMIN 전용 |
| `GET /api/admin/insurance-rates` | 보험요율 마스터 — 참조 데이터 |
| `GET /api/admin/labor-faqs` | 노무 FAQ — 참조 데이터 |
| `GET /api/admin/settings/*` | 플랫폼 설정 — SUPER_ADMIN 전용 |
| `POST /api/attendance/check-in-direct` | 근로자 전용 — worker context |
| `POST /api/attendance/check-out-direct` | 근로자 전용 |
| `GET /api/attendance/today` | 근로자 본인 조회 |

---

## 3. 권한 적용 패턴 요약

### 목록 API (siteId 직접 필드 있음)
```typescript
const scope = await buildSiteScopeWhere(session)
if (scope === false) return ok({ items: [], total: 0 })
const where = { ...scope, ...otherFilters }
```

### 목록 API (siteId 파라미터 제공 시)
```typescript
if (siteId) {
  if (!await canAccessSite(session, siteId)) return siteAccessDeniedWithLog(session, siteId)
  // use { siteId } in where
} else {
  const scope = await buildSiteScopeWhere(session)
  // use scope in where
}
```

### 단건 API (fetch 후 검증)
```typescript
const row = await prisma.xxx.findUnique({ where: { id } })
if (!row) return notFound()
if (!await canAccessSite(session, row.siteId)) return siteAccessDeniedWithLog(session, row.siteId)
```

### Worker 관련 API
```typescript
const workerScope = await buildWorkerScopeWhere(session)
if (workerScope === false) return ok({ items: [], total: 0 })
const where = { ...workerScope, ...otherFilters }
```

---

## 4. 새 API 작성 체크리스트

새로운 site 연관 API를 만들 때 반드시 확인:

- [ ] route param/query에 siteId가 있는가?
- [ ] `buildSiteScopeWhere()` 또는 `canAccessSite()` 적용 여부
- [ ] 목록/상세/쓰기 모두 동일하게 체크했는가?
- [ ] `siteAccessDeniedWithLog()` 로 denial 로그를 남기는가?
- [ ] export/aggregation API에도 동일 scope가 적용되는가?
- [ ] Worker 관련이면 `buildWorkerScopeWhere()` 사용했는가?
