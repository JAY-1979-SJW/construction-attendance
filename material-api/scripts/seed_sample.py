#!/usr/bin/env python3
"""
seed_sample.py — 샘플 자재 데이터 적재 (검증용)

실행:
  DATABASE_URL=... python scripts/seed_sample.py
"""

import os
import sys
from datetime import date, datetime
import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.environ.get("DATABASE_URL", "")

SAMPLE_MATERIALS = [
    # (code,          name,               spec,          unit, category, sub_category,   base_price, source,  base_date)
    ("NARA-STL-001", "철근",              "HD13",        "TON", "철강재", "이형철근",     1050000,    "nara", date(2026, 4, 1)),
    ("NARA-STL-002", "철근",              "HD16",        "TON", "철강재", "이형철근",     1048000,    "nara", date(2026, 4, 1)),
    ("NARA-STL-003", "H형강",             "200×200",     "TON", "철강재", "형강",         1120000,    "nara", date(2026, 4, 1)),
    ("NARA-CON-001", "레미콘",            "25-24-15",    "M3",  "콘크리트", "레미콘",     82000,      "nara", date(2026, 4, 1)),
    ("NARA-CON-002", "레미콘",            "25-21-15",    "M3",  "콘크리트", "레미콘",     80000,      "nara", date(2026, 4, 1)),
    ("NARA-WOD-001", "합판",              "12T",         "M2",  "목재",    "합판",        12500,      "nara", date(2026, 4, 1)),
    ("NARA-PIP-001", "강관비계",          "Φ48.6×2.4",  "M",   "가설재",  "강관비계",    3200,       "nara", date(2026, 4, 1)),
    ("KPI-STL-001",  "철근",              "HD13",        "TON", "철강재", "이형철근",     1055000,    "kpi",  date(2026, 4, 1)),
    ("KPI-CON-001",  "레미콘",            "25-24-15",    "M3",  "콘크리트", "레미콘",     83500,      "kpi",  date(2026, 4, 1)),
    ("KPI-WOD-001",  "구조용집성재",      "120×240",     "M3",  "목재",    "집성재",      920000,     "kpi",  date(2026, 4, 1)),
]

def run():
    if not DB_URL:
        print("[ERROR] DATABASE_URL 환경변수 없음", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(DB_URL)
    sql = """
        INSERT INTO materials (code, name, spec, unit, category, sub_category, base_price, source, base_date, updated_at)
        VALUES %s
        ON CONFLICT (code, source) DO UPDATE SET
            name         = EXCLUDED.name,
            spec         = EXCLUDED.spec,
            unit         = EXCLUDED.unit,
            base_price   = EXCLUDED.base_price,
            base_date    = EXCLUDED.base_date,
            updated_at   = NOW()
        RETURNING id, code, source
    """
    values = [
        (code, name, spec, unit, cat, subcat, price, source, bdate, datetime.now())
        for code, name, spec, unit, cat, subcat, price, source, bdate in SAMPLE_MATERIALS
    ]

    try:
        with conn.cursor() as cur:
            results = execute_values(cur, sql, values, fetch=True)
            conn.commit()

        # sync_log 기록
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO material_sync_log (source, total_count, inserted, updated, note) VALUES (%s, %s, %s, %s, %s)",
                ("seed", len(SAMPLE_MATERIALS), len(SAMPLE_MATERIALS), 0, "seed_sample.py 실행"),
            )
            conn.commit()

        print(f"[seed] 적재 완료: {len(results)}건")
        for row in results:
            print(f"  id={row[0]} code={row[1]} source={row[2]}")
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    run()
