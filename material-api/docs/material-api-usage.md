# material-api 사용 가이드

> **현재 데이터 상태 (반드시 읽을 것)**
>
> - 데이터 기준일: **2026-03-24** 이관본
> - `nara` 실수집: **보류 중** (`status: deferred`) — 나라장터 PriceInfoService 서버 장애
> - `base_price`: 현재 실가격 데이터 없음 → **항상 `null`**
> - 모든 응답에서 `price_available: false` 기준으로 사용할 것
> - 가격 데이터가 필요한 화면은 별도 안내 문구를 표시해야 함

---

## 공통

| 항목 | 값 |
|---|---|
| Base URL (내부) | `http://172.26.0.4:3020` |
| Content-Type (POST) | `application/json` |
| 응답 인코딩 | UTF-8 |
| CSV 응답 | BOM 포함 (`\uFEFF`) — Excel 한글 호환 |

---

## 엔드포인트

### 1. GET /api/health

**목적**: 서비스 생존 확인

```
GET /api/health
```

성공 응답:
```json
{ "status": "ok", "service": "material-api" }
```

실패: HTTP 5xx (컨테이너 다운)

비고: 배포 후 헬스체크, 모니터링에 사용

---

### 2. GET /api/materials — 자재 목록 검색

**목적**: 키워드·분류 필터로 자재 목록 조회 (페이지네이션)

```
GET /api/materials?q=전선관&category=전기시스템&source=nara&page=1&pageSize=50
```

| 파라미터 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| q | N | — | name 또는 code 부분 검색 |
| category | N | — | 분류명 exact match |
| source | N | — | `nara` 등 |
| page | N | 1 | 페이지 번호 |
| pageSize | N | 50 | 최대 200 |

성공 응답:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 33934,
        "code": "3913170620174408",
        "name": "1종금속제가요전선관",
        "spec": "1종금속제가요전선관, 10mm, 비방수",
        "unit": "개",
        "category": "전기시스템,조명,부품,액세서리및보조용품",
        "basePrice": null,
        "source": "nara",
        "baseDate": "2026-03-24T00:00:00.000Z",
        "updatedAt": "2026-04-12T17:54:23.641Z"
      }
    ],
    "total": 57298,
    "page": 1,
    "pageSize": 50,
    "totalPages": 1146,
    "price_available": false,
    "notice": "nara 데이터는 2026-03-24 기준 카탈로그 이관본이며 base_price=null (실수집 보류 중)"
  }
}
```

실패 응답:
```json
{ "success": false, "message": "..." }
```

비고: `price_available=false` 확인 후 가격 미제공 안내 표시 필요

**curl 예시**:
```bash
curl "http://172.26.0.4:3020/api/materials?q=전선관&pageSize=10"
```

---

### 3. GET /api/materials/:id — 자재 단건 상세

**목적**: DB id 기준 단건 조회

```
GET /api/materials/33934
```

성공 응답:
```json
{
  "success": true,
  "data": {
    "id": 33934,
    "code": "3913170620174408",
    "name": "1종금속제가요전선관",
    "spec": "1종금속제가요전선관, 10mm, 비방수",
    "unit": "개",
    "category": "전기시스템,조명,부품,액세서리및보조용품",
    "basePrice": null,
    "source": "nara",
    "baseDate": "2026-03-24T00:00:00.000Z",
    "updatedAt": "2026-04-12T17:54:23.641Z",
    "price_available": false,
    "notice": "..."
  }
}
```

실패 응답:
```json
{ "success": false, "message": "자재를 찾을 수 없습니다." }   // HTTP 404
```

비고: id는 DB 내부 PK. 외부 연동 시 code 기준 `by-code` 권장

---

### 4. GET /api/materials/by-code — code 기준 단건 조회

**목적**: 자재코드 + source 기준 단건 조회

```
GET /api/materials/by-code?code=3913170620174408&source=nara
```

| 파라미터 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| code | Y | — | 자재코드 |
| source | N | `nara` | 출처 |

성공 응답: `GET /api/materials/:id`와 동일 구조

실패 응답:
```json
{ "success": false, "message": "code는 필수입니다." }     // HTTP 400
{ "success": false, "message": "자재를 찾을 수 없습니다." } // HTTP 404
```

비고: 외부 코드 연동 시 이 API 사용 권장

**curl 예시**:
```bash
curl "http://172.26.0.4:3020/api/materials/by-code?code=3913170620174408"
```

---

### 5. POST /api/materials/lookup — 코드 목록 일괄 조회

**목적**: 최대 100개 자재코드를 한 번에 조회. 없는 코드도 `missingCodes`로 반환

```
POST /api/materials/lookup
Content-Type: application/json
```

요청 body:
```json
{
  "codes": ["3913170620174408", "3913170620174409", "NOTEXIST_9999"],
  "source": "nara"
}
```

| 필드 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| codes | Y | — | 자재코드 배열, 최대 100개. trim·빈값·중복 자동 제거 |
| source | N | `nara` | 출처 |

성공 응답:
```json
{
  "success": true,
  "data": {
    "requestedCount": 3,
    "foundCount": 2,
    "items": [
      {
        "id": 33934, "code": "3913170620174408", "name": "1종금속제가요전선관",
        "spec": "...", "unit": "개", "category": "...",
        "base_price": null, "source": "nara",
        "base_date": "2026-03-24T00:00:00.000Z", "updated_at": "..."
      }
    ],
    "missingCodes": ["NOTEXIST_9999"]
  }
}
```

실패 응답:
```json
{ "success": false, "message": "codes는 배열이어야 합니다." }      // HTTP 400
{ "success": false, "message": "codes는 최대 100개까지 허용됩니다." } // HTTP 400
```

비고: 견적/분석 로직에서 코드 목록 → 자재 정보 한 번에 조회 시 사용

**curl 예시**:
```bash
curl -X POST "http://172.26.0.4:3020/api/materials/lookup" \
  -H "Content-Type: application/json" \
  -d '{"codes":["3913170620174408","3913170620174409","NOTEXIST"]}'
```

---

### 6. POST /api/materials/lookup/export.csv — 코드 목록 일괄 조회 결과 CSV

**목적**: `lookup`과 동일한 조회를 CSV 파일로 다운로드. 없는 코드도 `found=false` 행으로 포함

```
POST /api/materials/lookup/export.csv
Content-Type: application/json
```

요청 body: `POST /api/materials/lookup`과 동일

CSV 컬럼:
```
input_code, found, id, code, name, spec, unit, category, base_price, source, base_date, updated_at
```

성공 응답: `text/csv; charset=utf-8` (BOM 포함, 파일명 `materials_lookup_2026-03-24.csv`)

실패 응답: HTTP 400 JSON

비고: 없는 코드는 `found=false`로 포함되므로 입력 전체 추적 가능

**curl 예시**:
```bash
curl -X POST "http://172.26.0.4:3020/api/materials/lookup/export.csv" \
  -H "Content-Type: application/json" \
  -d '{"codes":["3913170620174408","NOTEXIST"]}' \
  -o materials_result.csv
```

---

### 7. POST /api/materials/lookup/text — textarea 붙여넣기 일괄 조회

**목적**: 엑셀·문서에서 복사한 코드 목록을 그대로 붙여넣어 조회. 줄바꿈·쉼표·탭·공백 모두 구분자로 허용

```
POST /api/materials/lookup/text
Content-Type: application/json
```

요청 body:
```json
{
  "text": "3913170620174408\n3913170620174409\nNOTEXIST_9999",
  "source": "nara"
}
```

| 필드 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| text | Y | — | 구분자 자유. trim·빈값·중복 자동 제거. 최대 100개 |
| source | N | `nara` | 출처 |

성공 응답:
```json
{
  "success": true,
  "data": {
    "parsedCount": 3,
    "requestedCount": 3,
    "foundCount": 2,
    "items": [ ... ],
    "missingCodes": ["NOTEXIST_9999"]
  }
}
```

실패 응답:
```json
{ "success": false, "message": "text는 필수입니다." }            // HTTP 400
{ "success": false, "message": "codes는 최대 100개까지 허용됩니다." } // HTTP 400
```

비고: `parsedCount` = 구분자 제거 전 토큰 수, `requestedCount` = 중복 제거 후 실 조회 수

**curl 예시**:
```bash
curl -X POST "http://172.26.0.4:3020/api/materials/lookup/text" \
  -H "Content-Type: application/json" \
  -d '{"text":"3913170620174408\n3913170620174409\nNOTEXIST"}'
```

---

### 8. POST /api/materials/lookup/text/export.csv — textarea 입력 결과 CSV

**목적**: `lookup/text`와 동일한 조회를 CSV 파일로 다운로드

```
POST /api/materials/lookup/text/export.csv
Content-Type: application/json
```

요청 body: `POST /api/materials/lookup/text`와 동일

CSV 컬럼: `lookup/export.csv`와 동일 (`input_code, found, ...`)

성공 응답: `text/csv; charset=utf-8` (BOM 포함, 파일명 `materials_lookup_text_2026-03-24.csv`)

비고: 없는 코드 행도 포함되므로 붙여넣기 전체 추적 가능

**curl 예시**:
```bash
curl -X POST "http://172.26.0.4:3020/api/materials/lookup/text/export.csv" \
  -H "Content-Type: application/json" \
  -d '{"text":"3913170620174408\n3913170620174409\nNOTEXIST"}' \
  -o materials_text_result.csv
```

---

### 9. GET /api/materials/categories — 분류 목록

**목적**: 자재 분류명 목록과 각 건수 조회

```
GET /api/materials/categories
```

성공 응답:
```json
{
  "success": true,
  "data": [
    { "category": "가구,침구류및가정용 제품", "count": 312 },
    { "category": "건설설비 관리", "count": 1840 }
  ]
}
```

실패 응답: HTTP 5xx

비고: 검색 필터 드롭다운 구성에 사용

---

### 10. GET /api/materials/summary — 요약 통계

**목적**: 전체 자재 건수, 분류 수, 가격 현황 등 통계

```
GET /api/materials/summary
```

성공 응답:
```json
{
  "success": true,
  "data": {
    "totalMaterials": 57298,
    "totalCategories": 37,
    "sourceCounts": [{ "source": "nara", "count": 57298 }],
    "priceAvailableCount": 0,
    "priceMissingCount": 57298,
    "latestBaseDate": "2026-03-24T00:00:00.000Z",
    "categoryTop10": [ ... ],
    "price_available": false,
    "notice": "nara 데이터는 2026-03-24 기준 카탈로그 이관본이며 base_price=null (실수집 보류 중)"
  }
}
```

비고: 대시보드 통계 카드에 사용

---

### 11. GET /api/materials/sync-status — 수집 상태

**목적**: 데이터 수집 현황 확인

```
GET /api/materials/sync-status
```

성공 응답:
```json
{
  "success": true,
  "data": {
    "totalMaterials": 57298,
    "sourceStatus": [
      {
        "source": "nara",
        "status": "deferred",
        "reason": "나라장터 PriceInfoService 서버 장애로 실수집 보류",
        "dataType": "migration_from_nara_resources",
        "baseDate": "2026-03-24",
        "priceIncluded": false,
        "lastLiveSync": null
      }
    ],
    "recentSyncs": []
  }
}
```

비고: `status=deferred`이면 가격 데이터 없음. 운영 모니터링·상태 배너에 사용

---

### 12. GET /api/materials/suggest — 자동완성

**목적**: 검색창 자동완성. code prefix 우선정렬

```
GET /api/materials/suggest?q=3913&limit=10&category=전기시스템
```

| 파라미터 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| q | Y | — | 검색어 (비어있으면 빈 배열 반환) |
| limit | N | 10 | 최대 20 |
| category | N | — | 분류 필터 |

성공 응답:
```json
{
  "success": true,
  "data": [
    {
      "id": 33934,
      "code": "3913170620174408",
      "name": "1종금속제가요전선관",
      "spec": "...",
      "unit": "개",
      "category": "...",
      "source": "nara"
    }
  ]
}
```

비고: code prefix 매치 → name prefix 매치 → 나머지 순으로 정렬

---

## 프론트 연결 팁

| 상황 | 사용 API |
|---|---|
| 검색창 자동완성 | `GET /api/materials/suggest?q={입력값}` |
| 자재 목록표 | `GET /api/materials?q=...&category=...&page=...` |
| 자재 상세 패널 | `GET /api/materials/{id}` 또는 `GET /api/materials/by-code?code={code}` |
| 대량 코드 붙여넣기 조회 | `POST /api/materials/lookup/text` |
| 엑셀로 저장 (코드 목록) | `POST /api/materials/lookup/export.csv` 또는 `POST /api/materials/lookup/text/export.csv` |
| 전체 자재 엑셀 내보내기 | `GET /api/materials/export.csv?q=...&category=...` |
| 분류 필터 드롭다운 | `GET /api/materials/categories` |
| 가격 미제공 배너 표시 | `price_available=false` 확인 후 표시 |

---

## 데이터 현황 요약

| 항목 | 값 |
|---|---|
| 전체 자재 수 | 57,298건 |
| 분류 수 | 37개 |
| 데이터 기준일 | 2026-03-24 |
| 가격 데이터 | **없음** (실수집 보류) |
| nara 수집 상태 | **deferred** |

---

## 버전 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 2-15 | 2026-04-12 | 최초 사용 문서 작성 (2-1~2-14 기반) |
