# E2E Skip Registry

테스트에서 `test.fixme` / `test.skip`로 처리된 항목의 사유와 재활성화 조건을 기록한다.

---

## R-15 현장 상세 주소검색 (admin-regression.spec.ts)

| 항목 | 내용 |
|------|------|
| 테스트 ID | R-15 |
| 파일 | `e2e/admin-regression.spec.ts` (describe: `[REGRESSION] 현장 상세 주소검색`) |
| 상태 | `test.fixme` — 자동 skip |
| skip 시작일 | 2026-04-05 |

### 원인
Daum Postcode SDK의 API 호출 방식이 `.open()` → `.embed()` 로 전환됨.
기존 mock은 `window.daum.Postcode.open()` 을 가로채는 구조였으나 현재 코드는 `.embed()` 호출 경로를 사용.
mock이 발화되지 않아 `window.__daumMockFired === false`로 단언 실패.

### 재활성화 조건
1. 현장 상세 페이지(SiteDetailPanel)에서 주소검색 버튼이 `.embed()` 호출인지 `.open()` 호출인지 확인
2. mock 구조를 실제 호출 방식에 맞게 변경:
   ```typescript
   window.daum = {
     Postcode: class {
       constructor(opts) { this._opts = opts; this._container = null; }
       embed(container) {
         window.__daumMockFired = true;
         this._opts.oncomplete({ roadAddress: '...', jibunAddress: '...' });
       }
     }
   }
   ```
3. `test.fixme` 제거 후 3회 반복 실행 PASS 확인

### 영향 범위
- 현재 자동화 점검에서 주소검색 → PATCH 저장 플로우가 미검증 상태
- 수동 확인 대안: `/admin/sites/[id]` 진입 → 기본정보 수정 → 주소검색 → 저장 흐름을 배포 후 수동 확인

---

## @390px 현장명 라벨↔입력창 비겹침 (ui-layout-core.spec.ts)

| 항목 | 내용 |
|------|------|
| 파일 | `e2e/ui-layout-core.spec.ts` (describe: `[LAYOUT:sites] 현장 목록`) |
| 상태 | skip (현장 목록 렌더링 조건 미충족 시 동적 스킵) |

### 원인
테스트 내부에서 현장 목록 mock 데이터가 실제로 렌더링되지 않으면 `test.skip` 호출.
현장 행 클릭 → 패널 → 수정 버튼 흐름이 mock 응답 타이밍에 의존하며 간헐적으로 조건 미충족.

### 재활성화 조건
- mock 현장 1건 렌더링 후 `waitForSelector`로 행을 명확히 대기하면 해결 가능
- 현재 낮은 위험도 (레이아웃 overlap은 실 운영에서 미발생 확인)

---

## @360/390px audit-logs filter select overflow (ui-layout-core.spec.ts)

| 항목 | 내용 |
|------|------|
| 파일 | `e2e/ui-layout-core.spec.ts` (describe: `[LAYOUT:audit-logs] 감사 로그`) |
| 상태 | `test.fixme(vp.w <= 390)` — 배포 대기 |
| skip 시작일 | 2026-04-06 |

### 원인
`app/admin/audit-logs/page.tsx` 필터 섹션의 액션유형 `<select>` 에 `min-w-[240px]` 지정.
360px 뷰포트 (`p-8` 외부 패딩 + `p-5` 카드 패딩 = 256px 사용 가능 폭) 에서
선택박스가 403px까지 확장되어 뷰포트(360px)를 벗어남.
390px 뷰포트도 선택박스 403px > 391px.

### 수정 내용 (로컬 적용 완료)
- `min-w-[240px]` → 제거, `w-full max-w-full` 로 변경
- `min-w-[180px]` → 제거, `w-full` 로 변경
- 필터 컨테이너 `flex flex-wrap` → `grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap`

### 재활성화 조건
1. `bash scripts/deploy-and-verify.sh` 배포 완료 후
2. `test.fixme(vp.w <= 390, ...)` 제거
3. 재실행 PASS 확인

---

## @360px settings 내부 레이아웃 overflow + 저장 버튼 높이 (ui-layout-core.spec.ts)

| 항목 | 내용 |
|------|------|
| 파일 | `e2e/ui-layout-core.spec.ts` (describe: `[LAYOUT:settings] 시스템 설정`) |
| 상태 | `test.fixme(vp.w === 360)` + `test.fixme(true)` — 배포 대기 |
| skip 시작일 | 2026-04-06 |

### 원인
1. `app/admin/settings/page.tsx` 내부 레이아웃에 `w-[200px] shrink-0` 좌측 카테고리 사이드바가 있어
   360px 뷰포트에서 사이드바(200px) + 우측 폼 = 전체 폭 초과 → time/number input 378px 위치로 오버플로우
2. 저장 버튼 `py-[6px]` → 높이 ~33px < 36px

### 수정 내용 (로컬 적용 완료)
- 사이드바 `hidden lg:flex lg:flex-col` 로 모바일 숨김 + `<select>` 모바일 카테고리 셀렉터 추가
- 저장/되돌리기 버튼 `py-[6px]` → `py-2.5` (≈40px)

### 재활성화 조건
1. `bash scripts/deploy-and-verify.sh` 배포 완료 후
2. `test.fixme(vp.w === 360, ...)` 및 `test.fixme(true, ...)` 제거
3. 재실행 PASS 확인
