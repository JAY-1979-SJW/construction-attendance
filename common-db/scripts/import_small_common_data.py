#!/usr/bin/env python3
"""
common-db 소형 데이터 1차 이관
  labor_wage.db  → labor_periods + labor_wages
  rates.db       → insurance_rates
  이관 결과      → data_update_log (3건)

실행: python3 common-db/scripts/import_small_common_data.py
서버: python3 ~/app/attendance/common-db/scripts/import_small_common_data.py
"""

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

# ────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
DATA_DIR    = SCRIPT_DIR / ".." / "data"
ENV_FILE    = SCRIPT_DIR / ".." / ".env"
LABOR_DB    = DATA_DIR / "labor_wage.db"
RATES_DB    = DATA_DIR / "rates.db"


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
# insurance_rates — src_id 컬럼 + 유니크 인덱스 준비
# ────────────────────────────────────────────
def ensure_insurance_src_id(cur):
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'insurance_rates' AND column_name = 'src_id'
    """)
    if not cur.fetchone():
        cur.execute("ALTER TABLE insurance_rates ADD COLUMN src_id INT")
        print("  [DDL] insurance_rates.src_id 컬럼 추가")

    cur.execute("""
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'insurance_rates'
          AND constraint_name = 'uq_insurance_src_id'
          AND constraint_type = 'UNIQUE'
    """)
    if not cur.fetchone():
        cur.execute("""
            ALTER TABLE insurance_rates
            ADD CONSTRAINT uq_insurance_src_id UNIQUE (src_id)
        """)
        print("  [DDL] uq_insurance_src_id UNIQUE 제약 생성")


# ────────────────────────────────────────────
# 이관 함수들
# ────────────────────────────────────────────
def import_labor(pg_conn):
    started = datetime.now(timezone.utc)
    sq = sqlite3.connect(LABOR_DB)
    sq.row_factory = sqlite3.Row

    periods = sq.execute("SELECT period_code, name, start_date, end_date FROM periods").fetchall()
    wages   = sq.execute("SELECT period_code, job_type, daily_wage FROM wages").fetchall()
    sq.close()

    cur = pg_conn.cursor()

    # ── labor_periods ─────────────────────────────────────
    ins_p = upd_p = 0
    for row in periods:
        cur.execute("""
            INSERT INTO labor_periods (period_code, name, start_date, end_date)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (period_code) DO UPDATE
                SET name       = EXCLUDED.name,
                    start_date = EXCLUDED.start_date,
                    end_date   = EXCLUDED.end_date
            RETURNING (xmax = 0) AS is_insert
        """, (row["period_code"], row["name"], row["start_date"], row["end_date"]))
        if cur.fetchone()[0]:
            ins_p += 1
        else:
            upd_p += 1

    # ── labor_wages ───────────────────────────────────────
    ins_w = upd_w = 0
    for row in wages:
        cur.execute("""
            INSERT INTO labor_wages (period_code, job_type, daily_wage)
            VALUES (%s, %s, %s)
            ON CONFLICT (period_code, job_type) DO UPDATE
                SET daily_wage = EXCLUDED.daily_wage
            RETURNING (xmax = 0) AS is_insert
        """, (row["period_code"], row["job_type"], row["daily_wage"]))
        if cur.fetchone()[0]:
            ins_w += 1
        else:
            upd_w += 1

    total_periods = ins_p + upd_p
    total_wages   = ins_w + upd_w

    # ── data_update_log (periods) ─────────────────────────
    cur.execute("""
        INSERT INTO data_update_log
            (data_type, update_time, total_count, inserted_count, updated_count, status, message)
        VALUES (%s, %s, %s, %s, %s, 'success', %s)
    """, (
        "labor_periods",
        started,
        total_periods,
        ins_p, upd_p,
        f"labor_periods 이관 완료 (insert={ins_p}, update={upd_p})",
    ))

    # ── data_update_log (wages) ───────────────────────────
    cur.execute("""
        INSERT INTO data_update_log
            (data_type, update_time, total_count, inserted_count, updated_count, status, message)
        VALUES (%s, %s, %s, %s, %s, 'success', %s)
    """, (
        "labor_wages",
        started,
        total_wages,
        ins_w, upd_w,
        f"labor_wages 이관 완료 (insert={ins_w}, update={upd_w})",
    ))

    pg_conn.commit()
    print(f"  labor_periods : total={total_periods}  insert={ins_p}  update={upd_p}")
    print(f"  labor_wages   : total={total_wages}  insert={ins_w}  update={upd_w}")
    cur.close()


def import_rates(pg_conn):
    started = datetime.now(timezone.utc)
    sq = sqlite3.connect(RATES_DB)
    sq.row_factory = sqlite3.Row
    rows = sq.execute(
        "SELECT id, year, rate_type, industry_type, rate, base, note FROM insurance_rates"
    ).fetchall()
    sq.close()

    cur = pg_conn.cursor()
    ensure_insurance_src_id(cur)
    pg_conn.commit()   # DDL 커밋

    ins = upd = 0
    for row in rows:
        cur.execute("""
            INSERT INTO insurance_rates
                (src_id, year, rate_type, industry_type, rate, base, note)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (src_id) DO UPDATE
                SET year          = EXCLUDED.year,
                    rate_type     = EXCLUDED.rate_type,
                    industry_type = EXCLUDED.industry_type,
                    rate          = EXCLUDED.rate,
                    base          = EXCLUDED.base,
                    note          = EXCLUDED.note
            RETURNING (xmax = 0) AS is_insert
        """, (
            row["id"], row["year"], row["rate_type"],
            row["industry_type"], row["rate"], row["base"], row["note"],
        ))
        if cur.fetchone()[0]:
            ins += 1
        else:
            upd += 1

    total = ins + upd
    cur.execute("""
        INSERT INTO data_update_log
            (data_type, update_time, total_count, inserted_count, updated_count, status, message)
        VALUES (%s, %s, %s, %s, %s, 'success', %s)
    """, (
        "insurance_rates",
        started,
        total, ins, upd,
        f"insurance_rates 이관 완료 (insert={ins}, update={upd})",
    ))

    pg_conn.commit()
    print(f"  insurance_rates: total={total}  insert={ins}  update={upd}")
    cur.close()


# ────────────────────────────────────────────
# main
# ────────────────────────────────────────────
def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] common-db 소형 데이터 이관 시작")

    env = load_env(ENV_FILE)
    pg  = pg_connect(env)

    try:
        print("\n[1] labor_periods + labor_wages")
        import_labor(pg)

        print("\n[2] insurance_rates")
        import_rates(pg)

    except Exception as e:
        pg.rollback()
        print(f"\n[ERROR] {e}")
        raise
    finally:
        pg.close()

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 이관 완료")


if __name__ == "__main__":
    main()
