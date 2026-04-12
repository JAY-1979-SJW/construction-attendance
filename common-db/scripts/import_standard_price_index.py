#!/usr/bin/env python3
"""
common-db 표준시장단가 지수 이관
  standard_price_index.db → standard_price_index

실행: python3 common-db/scripts/import_standard_price_index.py
서버: python3 ~/app/attendance/common-db/scripts/import_standard_price_index.py
"""

import sys
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

# ────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
DATA_DIR   = SCRIPT_DIR / ".." / "data"
ENV_FILE   = SCRIPT_DIR / ".." / ".env"
SRC_DB     = DATA_DIR / "standard_price_index.db"


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
# DDL 보강: (category, period) UNIQUE 제약
# ────────────────────────────────────────────
def ensure_unique(cur):
    cur.execute("""
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name='standard_price_index'
          AND constraint_name='uq_spi_category_period'
          AND constraint_type='UNIQUE'
    """)
    if not cur.fetchone():
        cur.execute("""
            ALTER TABLE standard_price_index
            ADD CONSTRAINT uq_spi_category_period UNIQUE (category, period)
        """)
        print("  [DDL] uq_spi_category_period UNIQUE 제약 생성")


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
# 이관
# ────────────────────────────────────────────
def import_standard_price_index(pg_conn):
    started = datetime.now(timezone.utc)

    sq = sqlite3.connect(SRC_DB)
    sq.row_factory = sqlite3.Row
    rows = sq.execute("""
        SELECT category, period, base_index, compare_index,
               change_rate, source, fetched_at
        FROM standard_index
    """).fetchall()
    sq.close()

    cur = pg_conn.cursor()
    ensure_unique(cur)
    pg_conn.commit()

    ins = upd = fail = 0
    for row in rows:
        try:
            cur.execute("""
                INSERT INTO standard_price_index
                  (category, period, base_index, compare_index,
                   change_rate, source, fetched_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (category, period) DO UPDATE
                  SET base_index    = EXCLUDED.base_index,
                      compare_index = EXCLUDED.compare_index,
                      change_rate   = EXCLUDED.change_rate,
                      source        = EXCLUDED.source,
                      fetched_at    = EXCLUDED.fetched_at
                RETURNING (xmax = 0) AS is_insert
            """, (
                row["category"], row["period"],
                row["base_index"], row["compare_index"],
                row["change_rate"], row["source"], row["fetched_at"],
            ))
            if cur.fetchone()[0]:
                ins += 1
            else:
                upd += 1
        except Exception as e:
            fail += 1
            print(f"  [WARN] {row['category']}/{row['period']}: {e}", file=sys.stderr)

    finished = datetime.now(timezone.utc)
    total = ins + upd + fail
    write_log(cur,
        data_type="standard_price_index",
        source_file="standard_price_index.db",
        total=total, ins=ins, upd=upd, fail=fail,
        started=started, finished=finished,
        note=f"insert={ins} update={upd} fail={fail}",
    )
    pg_conn.commit()
    print(f"  standard_price_index: total={total}  insert={ins}  update={upd}  fail={fail}")
    cur.close()


# ────────────────────────────────────────────
# main
# ────────────────────────────────────────────
def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] standard_price_index 이관 시작")

    env = load_env(ENV_FILE)
    pg  = pg_connect(env)

    try:
        import_standard_price_index(pg)
    except Exception as e:
        pg.rollback()
        print(f"\n[ERROR] {e}", file=sys.stderr)
        raise
    finally:
        pg.close()

    print(f"[{datetime.now().strftime('%H:%M:%S')}] 이관 완료")


if __name__ == "__main__":
    main()
