#!/usr/bin/env python3
"""
common-db 중형 데이터 2차 이관
  machine_cost.db  → machine_costs
  ecos_index.db    → ecos_indices
  이관 결과        → data_update_log

실행: python3 common-db/scripts/import_medium_common_data.py
서버: python3 ~/app/attendance/common-db/scripts/import_medium_common_data.py
"""

import sys
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

# ────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────
SCRIPT_DIR    = Path(__file__).parent
DATA_DIR      = SCRIPT_DIR / ".." / "data"
ENV_FILE      = SCRIPT_DIR / ".." / ".env"
MACHINE_DB    = DATA_DIR / "machine_cost.db"
ECOS_DB       = DATA_DIR / "ecos_index.db"


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
# data_update_log 컬럼 보강 (source_file, finished_at, failed_count)
# ────────────────────────────────────────────
def ensure_log_columns(cur):
    extras = [
        ("source_file",   "ALTER TABLE data_update_log ADD COLUMN source_file VARCHAR(200)"),
        ("finished_at",   "ALTER TABLE data_update_log ADD COLUMN finished_at TIMESTAMPTZ"),
        ("failed_count",  "ALTER TABLE data_update_log ADD COLUMN failed_count INTEGER DEFAULT 0"),
    ]
    for col, ddl in extras:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='data_update_log' AND column_name=%s
        """, (col,))
        if not cur.fetchone():
            cur.execute(ddl)
            print(f"  [DDL] data_update_log.{col} 컬럼 추가")


# ────────────────────────────────────────────
# machine_costs DDL 보강
#   src_id (원본 id, UNIQUE), 누락 컬럼 추가
# ────────────────────────────────────────────
def ensure_machine_columns(cur):
    extras = [
        ("src_id",          "ALTER TABLE machine_costs ADD COLUMN src_id INT"),
        ("depreciation",    "ALTER TABLE machine_costs ADD COLUMN depreciation NUMERIC(12,2)"),
        ("operation_cost",  "ALTER TABLE machine_costs ADD COLUMN operation_cost NUMERIC(12,2)"),
        ("fuel_type",       "ALTER TABLE machine_costs ADD COLUMN fuel_type VARCHAR(20)"),
        ("fuel_consumption","ALTER TABLE machine_costs ADD COLUMN fuel_consumption NUMERIC(8,3)"),
        ("operator_ratio",  "ALTER TABLE machine_costs ADD COLUMN operator_ratio NUMERIC(5,3)"),
    ]
    for col, ddl in extras:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='machine_costs' AND column_name=%s
        """, (col,))
        if not cur.fetchone():
            cur.execute(ddl)
            print(f"  [DDL] machine_costs.{col} 컬럼 추가")

    # 기존 (year, half, machine_code) unique 제약 제거 — machine_code 빈값 충돌 방지
    cur.execute("""
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name='machine_costs'
          AND constraint_name='machine_costs_year_half_machine_code_key'
    """)
    if cur.fetchone():
        cur.execute("""
            ALTER TABLE machine_costs
            DROP CONSTRAINT machine_costs_year_half_machine_code_key
        """)
        print("  [DDL] machine_costs 기존 (year,half,machine_code) 제약 삭제")

    # fuel_type 길이 보강 (원본에 최대 31자 값 존재)
    cur.execute("""
        SELECT character_maximum_length FROM information_schema.columns
        WHERE table_name='machine_costs' AND column_name='fuel_type'
    """)
    row = cur.fetchone()
    if row and row[0] and row[0] < 100:
        cur.execute("ALTER TABLE machine_costs ALTER COLUMN fuel_type TYPE VARCHAR(100)")
        print("  [DDL] machine_costs.fuel_type → VARCHAR(100)")

    # unit 길이 보강 (원본에 최대 69자 값 존재)
    cur.execute("""
        SELECT character_maximum_length FROM information_schema.columns
        WHERE table_name='machine_costs' AND column_name='unit'
    """)
    row = cur.fetchone()
    if row and row[0] and row[0] < 200:
        cur.execute("ALTER TABLE machine_costs ALTER COLUMN unit TYPE VARCHAR(200)")
        print("  [DDL] machine_costs.unit → VARCHAR(200)")

    # UNIQUE CONSTRAINT on src_id
    cur.execute("""
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name='machine_costs' AND constraint_name='uq_machine_src_id'
    """)
    if not cur.fetchone():
        cur.execute("DROP INDEX IF EXISTS uq_machine_src_id")
        cur.execute("""
            ALTER TABLE machine_costs
            ADD CONSTRAINT uq_machine_src_id UNIQUE (src_id)
        """)
        print("  [DDL] machine_costs uq_machine_src_id 제약 생성")


# ────────────────────────────────────────────
# ecos_indices DDL 보강
#   unique key 에 cost_group 포함 (원본에 동일 stat+item+period 다른 cost_group 존재)
# ────────────────────────────────────────────
def ensure_ecos_constraint(cur):
    # 기존 (stat_code, item_code, period) 제약 확인
    cur.execute("""
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name='ecos_indices' AND constraint_type='UNIQUE'
          AND constraint_name='ecos_indices_stat_code_item_code_period_key'
    """)
    old = cur.fetchone()
    if old:
        cur.execute("""
            ALTER TABLE ecos_indices
            DROP CONSTRAINT ecos_indices_stat_code_item_code_period_key
        """)
        print("  [DDL] 기존 ecos_indices 3-col unique 제약 삭제")

    cur.execute("""
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name='ecos_indices' AND constraint_name='uq_ecos_4col'
    """)
    if not cur.fetchone():
        cur.execute("""
            ALTER TABLE ecos_indices
            ADD CONSTRAINT uq_ecos_4col
            UNIQUE (stat_code, item_code, period, cost_group)
        """)
        print("  [DDL] ecos_indices uq_ecos_4col (stat+item+period+cost_group) 생성")


# ────────────────────────────────────────────
# write_log helper
# ────────────────────────────────────────────
def write_log(cur, *, data_type, source_file, total, ins, upd, fail, started, finished, note=""):
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
# 이관: machine_costs
# ────────────────────────────────────────────
HALF_MAP = {"상반기": 1, "하반기": 2}

def import_machine(pg_conn):
    started = datetime.now(timezone.utc)
    sq = sqlite3.connect(MACHINE_DB)
    sq.row_factory = sqlite3.Row
    rows = sq.execute("""
        SELECT id, year, half, category, machine_code, machine_name, spec, unit,
               rental_cost, depreciation, operation_cost,
               fuel_type, fuel_consumption, operator_ratio
        FROM machine_costs
    """).fetchall()
    sq.close()

    cur = pg_conn.cursor()
    ensure_machine_columns(cur)
    pg_conn.commit()

    ins = upd = fail = 0
    cur.execute("SAVEPOINT sp_mc")   # 첫 savepoint 초기화
    for row in rows:
        half_val = HALF_MAP.get(row["half"])
        if half_val is None:
            # 알 수 없는 half 값은 건너뜀
            fail += 1
            continue

        machine_name = row["machine_name"] or ""   # NOT NULL 처리

        try:
            cur.execute("""
                INSERT INTO machine_costs
                  (src_id, year, half, category, machine_code, machine_name, spec, unit,
                   rental_cost, depreciation, operation_cost,
                   fuel_type, fuel_consumption, operator_ratio)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (src_id) DO UPDATE
                  SET year             = EXCLUDED.year,
                      half             = EXCLUDED.half,
                      category         = EXCLUDED.category,
                      machine_code     = EXCLUDED.machine_code,
                      machine_name     = EXCLUDED.machine_name,
                      spec             = EXCLUDED.spec,
                      unit             = EXCLUDED.unit,
                      rental_cost      = EXCLUDED.rental_cost,
                      depreciation     = EXCLUDED.depreciation,
                      operation_cost   = EXCLUDED.operation_cost,
                      fuel_type        = EXCLUDED.fuel_type,
                      fuel_consumption = EXCLUDED.fuel_consumption,
                      operator_ratio   = EXCLUDED.operator_ratio
                RETURNING (xmax = 0) AS is_insert
            """, (
                row["id"], row["year"], half_val,
                row["category"], row["machine_code"], machine_name,
                row["spec"], row["unit"],
                row["rental_cost"], row["depreciation"], row["operation_cost"],
                row["fuel_type"], row["fuel_consumption"], row["operator_ratio"],
            ))
            if cur.fetchone()[0]:
                ins += 1
            else:
                upd += 1
        except Exception as e:
            fail += 1
            print(f"  [WARN] machine src_id={row['id']}: {e}", file=sys.stderr)
            cur.execute("ROLLBACK TO sp_mc")
            continue

        cur.execute("SAVEPOINT sp_mc")

    finished = datetime.now(timezone.utc)
    total = ins + upd + fail
    write_log(cur,
        data_type="machine_costs",
        source_file="machine_cost.db",
        total=total, ins=ins, upd=upd, fail=fail,
        started=started, finished=finished,
        note=f"insert={ins} update={upd} fail={fail} (half='상반기'→1,'하반기'→2)",
    )
    pg_conn.commit()
    print(f"  machine_costs : total={total}  insert={ins}  update={upd}  fail={fail}")
    cur.close()


# ────────────────────────────────────────────
# 이관: ecos_indices
# ────────────────────────────────────────────
def import_ecos(pg_conn):
    started = datetime.now(timezone.utc)
    sq = sqlite3.connect(ECOS_DB)
    sq.row_factory = sqlite3.Row
    rows = sq.execute("""
        SELECT cost_group, period, value, stat_code, item_code, item_name, fetched_at
        FROM ecos_index
    """).fetchall()
    sq.close()

    cur = pg_conn.cursor()
    ensure_ecos_constraint(cur)
    pg_conn.commit()

    ins = upd = fail = 0
    cur.execute("SAVEPOINT sp_ec")
    for row in rows:
        try:
            cur.execute("""
                INSERT INTO ecos_indices
                  (cost_group, period, value, stat_code, item_code, item_name, fetched_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (stat_code, item_code, period, cost_group) DO UPDATE
                  SET value      = EXCLUDED.value,
                      item_name  = EXCLUDED.item_name,
                      fetched_at = EXCLUDED.fetched_at
                RETURNING (xmax = 0) AS is_insert
            """, (
                row["cost_group"], row["period"], row["value"],
                row["stat_code"], row["item_code"], row["item_name"],
                row["fetched_at"],
            ))
            if cur.fetchone()[0]:
                ins += 1
            else:
                upd += 1
        except Exception as e:
            fail += 1
            print(f"  [WARN] ecos {row['stat_code']}/{row['item_code']}/{row['period']}: {e}", file=sys.stderr)
            cur.execute("ROLLBACK TO sp_ec")
            continue
        cur.execute("SAVEPOINT sp_ec")

    finished = datetime.now(timezone.utc)
    total = ins + upd + fail
    write_log(cur,
        data_type="ecos_indices",
        source_file="ecos_index.db",
        total=total, ins=ins, upd=upd, fail=fail,
        started=started, finished=finished,
        note=f"insert={ins} update={upd} fail={fail}",
    )
    pg_conn.commit()
    print(f"  ecos_indices  : total={total}  insert={ins}  update={upd}  fail={fail}")
    cur.close()


# ────────────────────────────────────────────
# main
# ────────────────────────────────────────────
def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] common-db 중형 데이터 이관 시작")

    env = load_env(ENV_FILE)
    pg  = pg_connect(env)

    try:
        # data_update_log 컬럼 보강 (source_file, finished_at, failed_count)
        _cur = pg.cursor()
        ensure_log_columns(_cur)
        pg.commit()
        _cur.close()

        print("\n[1] machine_costs")
        import_machine(pg)

        print("\n[2] ecos_indices")
        import_ecos(pg)

    except Exception as e:
        pg.rollback()
        print(f"\n[ERROR] {e}", file=sys.stderr)
        raise
    finally:
        pg.close()

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 이관 완료")


if __name__ == "__main__":
    main()
