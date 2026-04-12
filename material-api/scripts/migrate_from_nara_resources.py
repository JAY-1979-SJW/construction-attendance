#!/usr/bin/env python3
"""
migrate_from_nara_resources.py — nara_resources 재료(M) → materials 마이그레이션

nara_resources 테이블에 이미 수집된 재료 데이터를 materials 테이블로 UPSERT.
- rsce_ty_extrnl_cd = 'M' 필터
- lbrcst = 0 은 NULL 처리
- UNIQUE(code, source) 기준 upsert

실행:
  DATABASE_URL=postgresql://... python scripts/migrate_from_nara_resources.py
"""

import os
import sys
from datetime import datetime

try:
    import psycopg2
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2

DB_URL = os.environ.get("DATABASE_URL", "")
if not DB_URL:
    print("[ERROR] DATABASE_URL 환경변수 없음", file=sys.stderr)
    sys.exit(1)


def run():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    print(f"[{datetime.now():%H:%M:%S}] nara_resources → materials UPSERT 시작...", flush=True)

    # 소스 건수 확인
    cur.execute("""
        SELECT COUNT(*) FROM nara_resources
        WHERE rsce_ty_extrnl_cd = 'M'
          AND net_rsce_cd IS NOT NULL
          AND TRIM(net_rsce_cd) <> ''
          AND TRIM(rsce_nm) <> ''
    """)
    source_count = cur.fetchone()[0]
    print(f"  소스 건수: {source_count:,}건", flush=True)

    cur.execute("""
        INSERT INTO materials
            (code, name, spec, unit, category, sub_category, base_price, source, base_date, updated_at)
        SELECT
            nr.net_rsce_cd,
            nr.rsce_nm,
            NULLIF(TRIM(COALESCE(nr.rsce_spec_nm, '')), ''),
            COALESCE(NULLIF(TRIM(COALESCE(nr.unit, '')), ''), '-'),
            COALESCE(NULLIF(TRIM(COALESCE(nr.lvl_rsce_clsfc_nm1, '')), ''), '미분류'),
            NULLIF(TRIM(COALESCE(nr.lvl_rsce_clsfc_nm2, '')), ''),
            CASE WHEN nr.lbrcst IS NULL OR nr.lbrcst = 0 THEN NULL ELSE nr.lbrcst END,
            'nara',
            nr.collected_at::date,
            NOW()
        FROM nara_resources nr
        WHERE nr.rsce_ty_extrnl_cd = 'M'
          AND nr.net_rsce_cd IS NOT NULL
          AND TRIM(nr.net_rsce_cd) <> ''
          AND TRIM(nr.rsce_nm) <> ''
        ON CONFLICT (code, source) DO UPDATE SET
            name         = EXCLUDED.name,
            spec         = EXCLUDED.spec,
            unit         = EXCLUDED.unit,
            category     = EXCLUDED.category,
            sub_category = EXCLUDED.sub_category,
            base_price   = EXCLUDED.base_price,
            base_date    = EXCLUDED.base_date,
            updated_at   = NOW()
        RETURNING (xmax = 0) AS is_inserted
    """)

    results = cur.fetchall()
    inserted = sum(1 for r in results if r[0])
    updated  = sum(1 for r in results if not r[0])
    conn.commit()
    print(f"  UPSERT 완료 — inserted={inserted:,} updated={updated:,}", flush=True)

    # sync_log 기록
    cur.execute("""
        INSERT INTO material_sync_log (source, total_count, inserted, updated, failed, note)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        "nara", inserted + updated, inserted, updated, 0,
        "nara_resources 재료(M) 마이그레이션 — lbrcst=0 → NULL 처리",
    ))
    conn.commit()
    print("  sync_log 기록 완료", flush=True)

    # 검증
    cur.execute("SELECT COUNT(*), source FROM materials GROUP BY source ORDER BY source")
    print("\n[materials 적재 현황]")
    for row in cur.fetchall():
        print(f"  {row[1]}: {row[0]:,}건")

    cur.execute("""
        SELECT category, COUNT(*) cnt FROM materials WHERE source = 'nara'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 8
    """)
    print("\n[nara 대분류 상위 8]")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]:,}건")

    cur.execute("""
        SELECT code, name, spec, unit, category, base_price, base_date
        FROM materials WHERE source = 'nara'
        LIMIT 5
    """)
    print("\n[샘플 5건]")
    for row in cur.fetchall():
        print(f"  {row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} | price={row[5]} | {row[6]}")

    cur.execute("""
        SELECT id, source, total_count, inserted, updated, failed, synced_at, note
        FROM material_sync_log ORDER BY id DESC LIMIT 3
    """)
    print("\n[sync_log 최근 3건]")
    for row in cur.fetchall():
        print(f"  id={row[0]} src={row[1]} total={row[2]} ins={row[3]} upd={row[4]} fail={row[5]} at={row[6]:%Y-%m-%d %H:%M} | {row[7]}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
