#!/usr/bin/env python3
"""
common-db g2b_standard_price 이관
  standard_price.db (조달청 나라장터 물품단가) → g2b_standard_price

실행: python3 common-db/scripts/import_g2b_standard_price.py
서버: python3 ~/app/attendance/common-db/scripts/import_g2b_standard_price.py

[원본 특이사항]
- 게시일자 포맷 혼재: 'YYYYMMDD' / 'YYYY-MM-DD HH:MM:SS' → DATE 정규화 필요
- (물품식별코드, 게시일자) 기준 2,134건 중복 (동일 날짜 가격 상이) → 마지막 행 우선
- 전체 컬럼 완전 중복 118건 → Python dict에서 자동 제거
- 원본에 인도조건명/공급관할지역명/부가가치세포함여부 있음 → ALTER TABLE 후 적재
"""

import sys
import sqlite3
from datetime import date, datetime
from pathlib import Path

import psycopg2

# ────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
DATA_DIR   = SCRIPT_DIR / ".." / "data"
ENV_FILE   = SCRIPT_DIR / ".." / ".env"
SRC_DB     = DATA_DIR / "standard_price.db"


# ────────────────────────────────────────────
# .env 파싱
# ────────────────────────────────────────────
def load_env(env_path: Path) -> dict:
    env = {}
    if not env_path.exists():
        raise FileNotFoundError(f".env 파일 없음: {env_path}")
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


# ────────────────────────────────────────────
# PostgreSQL 연결
# ────────────────────────────────────────────
def pg_connect(env: dict):
    return psycopg2.connect(
        host="127.0.0.1",
        port=5435,
        dbname="common_data",
        user="common_admin",
        password=env["COMMON_ADMIN_PASSWORD"],
    )


# ────────────────────────────────────────────
# 게시일자 정규화
#   'YYYYMMDD'               → date
#   'YYYY-MM-DD HH:MM:SS'    → date
#   'YYYY-MM-DD HH:MM:SS.fff'→ date
# ────────────────────────────────────────────
def parse_acquired_at(raw: str) -> date | None:
    if not raw:
        return None
    raw = raw.strip()
    if len(raw) == 8 and raw.isdigit():
        return date(int(raw[:4]), int(raw[4:6]), int(raw[6:8]))
    try:
        return datetime.fromisoformat(raw).date()
    except ValueError:
        return None


# ────────────────────────────────────────────
# DDL 보강
#   원본 추가 컬럼 (인도조건명, 공급관할지역명, 부가가치세포함여부)
# ────────────────────────────────────────────
def ensure_columns(cur):
    extras = [
        ("delivery_condition", "ALTER TABLE g2b_standard_price ADD COLUMN delivery_condition VARCHAR(20)"),
        ("supply_region",      "ALTER TABLE g2b_standard_price ADD COLUMN supply_region VARCHAR(20)"),
        ("vat_type",           "ALTER TABLE g2b_standard_price ADD COLUMN vat_type VARCHAR(20)"),
    ]
    for col, ddl in extras:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='g2b_standard_price' AND column_name=%s
        """, (col,))
        if not cur.fetchone():
            cur.execute(ddl)
            print(f"  [DDL] g2b_standard_price.{col} 컬럼 추가")


# ────────────────────────────────────────────
# write_log helper
# ────────────────────────────────────────────
def write_log(cur, *, data_type, source_file, total, ins, upd, fail,
              started, finished, note=""):
    cur.execute("""
        INSERT INTO data_update_log
          (data_type, update_time, total_count, inserted_count, updated_count,
           failed_count, source_file, finished_at, status, message)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        data_type, started, total, ins, upd, fail,
        source_file, finished,
        "success" if fail == 0 else "partial",
        note,
    ))


# ────────────────────────────────────────────
# 이관 (TODO: 실제 실행은 5-2단계에서)
# ────────────────────────────────────────────
def import_g2b(pg_conn):
    # TODO: 실제 이관 로직 (5-2단계에서 구현)
    #
    # 처리 순서:
    # 1. SQLite에서 전체 로드
    # 2. parse_acquired_at()으로 게시일자 정규화
    # 3. (spec_code, acquired_at) 기준 dict dedup — 마지막 행 우선
    # 4. ON CONFLICT (spec_code, acquired_at) DO UPDATE
    # 5. xmax=0 트릭으로 insert/update 구분
    # 6. write_log()
    raise NotImplementedError("5-2단계에서 구현 예정")


# ────────────────────────────────────────────
# main
# ────────────────────────────────────────────
def main():
    from datetime import timezone
    started = datetime.now(timezone.utc)
    print(f"[{started.strftime('%H:%M:%S')}] g2b_standard_price 이관 시작")

    env = load_env(ENV_FILE)
    pg  = pg_connect(env)

    try:
        cur = pg.cursor()
        ensure_columns(cur)
        pg.commit()
        cur.close()

        import_g2b(pg)

    except NotImplementedError as e:
        print(f"  [INFO] {e}")
    except Exception as e:
        pg.rollback()
        print(f"\n[ERROR] {e}", file=sys.stderr)
        raise
    finally:
        pg.close()


if __name__ == "__main__":
    main()
