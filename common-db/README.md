# common-db — 공용 건설 기준 데이터 DB

## 목적

건설 프로젝트에서 여러 앱이 공통으로 사용하는 기준 데이터를 전용 PostgreSQL 컨테이너로 관리한다.

포함 데이터: 조달청 물품단가 / 건설기계경비 / 노임단가 / 보험요율 / ECOS 물가지수 / 표준시장단가

---

## 기동 방법

```bash
# 1. 환경변수 파일 준비 (최초 1회)
cp .env.example .env
# .env 파일을 열어 실제 비밀번호로 변경

# 2. 컨테이너 기동
docker compose up -d

# 3. 상태 확인
docker ps | grep common-db
docker inspect common-db --format '{{.State.Health.Status}}'
```

---

## 접속 정보

| 항목 | 값 |
|-----|---|
| 포트 | `127.0.0.1:5435` (서버 내부 전용) |
| DB 이름 | `common_data` |
| 관리자 계정 | `common_admin` |

```bash
# 로컬에서 접속 (SSH 터널 필요)
psql -h 127.0.0.1 -p 5435 -U common_admin -d common_data

# 서버에서 직접 접속
docker exec -it common-db psql -U common_admin -d common_data
```

---

## 계정 역할

| 계정 | 권한 | 사용처 |
|-----|-----|-------|
| `common_admin` | 전체 (DDL 포함) | 마이그레이션, 관리 |
| `common_writer` | INSERT/UPDATE/DELETE | 갱신 스케줄러 |
| `common_reader` | SELECT 전용 | material-api, 조회 앱 |

---

## 로컬 → GitHub → 서버 반영 규칙

```
로컬 수정
  → git commit + push
  → 서버: git pull --ff-only
  → docker compose up -d   (스키마 변경 없을 때)
  → 스키마 변경 시: 마이그레이션 SQL 별도 실행
  → health 확인
```

**금지 행동**:
- `scp` 또는 파일 직접 전송
- `docker cp` 로 컨테이너 내부 파일 수정
- 서버에서 직접 init SQL 수정
- `.env` 파일 Git 커밋

---

## 스키마 구조

```sql
g2b_standard_price    -- 조달청 물품단가 (나라장터)
machine_costs         -- 건설기계경비
labor_periods         -- 노임단가 기간 정의
labor_wages           -- 노임단가 직종별 일당
insurance_rates       -- 보험요율 / 제비율
ecos_indices          -- ECOS 물가지수 (한국은행)
standard_price_index  -- 표준시장단가 인덱스
data_update_log       -- 갱신 이력 통합 로그
```

---

## 데이터 이관 로드맵

1. [완료] 컨테이너 구축 + 스키마 골격
2. [ ] labor_wages + insurance_rates 이관 (소형)
3. [ ] ecos_indices + machine_costs 이관
4. [ ] g2b_standard_price 이관 (대형)
5. [ ] material-api 연동 전환
6. [ ] 갱신 스케줄러 PostgreSQL 대상으로 전환
