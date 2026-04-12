#!/usr/bin/env python3
"""
collect_materials.py — 공용 자재 데이터 수집 스크립트 (1차 골격)

수집 대상:
  - nara: 나라장터 조달물가 (월 1회)
  - kpi : 한국물가정보 건설자재 시중단가 (주 1회)
  - mltm: 건설공사 표준시장단가 국토부 (분기 1회)

실행:
  python scripts/collect_materials.py --source nara
  python scripts/collect_materials.py --source kpi
  python scripts/collect_materials.py --source all

cron 예시 (주 1회 월요일 03:00):
  0 3 * * 1 cd ~/app/attendance/material-api && python scripts/collect_materials.py --source all >> logs/collect.log 2>&1
"""

import argparse
import os
import sys
import json
import urllib.request
from datetime import date, datetime
import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.environ.get("DATABASE_URL", "")


def get_conn():
    return psycopg2.connect(DB_URL)


def upsert_materials(conn, rows: list[dict], source: str) -> dict:
    """
    rows: [{ code, name, spec, unit, category, sub_category, base_price, base_date }]
    UPSERT ON CONFLICT (code, source) DO UPDATE
    """
    if not rows:
        return {"inserted": 0, "updated": 0, "failed": 0}

    sql = """
        INSERT INTO materials (code, name, spec, unit, category, sub_category, base_price, source, base_date, updated_at)
        VALUES %s
        ON CONFLICT (code, source) DO UPDATE SET
            name        = EXCLUDED.name,
            spec        = EXCLUDED.spec,
            unit        = EXCLUDED.unit,
            category    = EXCLUDED.category,
            sub_category= EXCLUDED.sub_category,
            base_price  = EXCLUDED.base_price,
            base_date   = EXCLUDED.base_date,
            updated_at  = NOW()
        RETURNING (xmax = 0) AS inserted
    """
    values = [
        (
            r["code"], r["name"], r.get("spec"), r["unit"],
            r["category"], r.get("sub_category"), r.get("base_price"),
            source, r["base_date"], datetime.now(),
        )
        for r in rows
    ]

    inserted = updated = failed = 0
    try:
        with conn.cursor() as cur:
            results = execute_values(cur, sql, values, fetch=True)
            for row in results:
                if row[0]:
                    inserted += 1
                else:
                    updated += 1
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] upsert failed: {e}", file=sys.stderr)
        failed = len(rows)

    return {"inserted": inserted, "updated": updated, "failed": failed}


def write_sync_log(conn, source: str, total: int, inserted: int, updated: int, failed: int, note: str = None):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO material_sync_log (source, total_count, inserted, updated, failed, note)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (source, total, inserted, updated, failed, note),
        )
    conn.commit()


# ── 출처별 수집 함수 ─────────────────────────────────────────────

def collect_nara() -> list[dict]:
    """
    나라장터 조달물가 수집 (실제 구현 필요)
    API: 공공데이터포털 나라장터 물가정보 API
    현재: 빈 리스트 반환 (API 키 설정 후 구현)
    """
    # TODO: API 키 설정 후 실제 수집 구현
    # api_key = os.environ.get("NARA_API_KEY", "")
    # url = f"https://apis.data.go.kr/.../getPriceInfo?serviceKey={api_key}&..."
    print("[nara] collect_nara: API 키 미설정, 수집 생략")
    return []


def collect_kpi() -> list[dict]:
    """
    한국물가정보(KPI) 건설자재 시중단가 수집
    현재: 빈 리스트 반환 (계약/크롤링 설정 후 구현)
    """
    print("[kpi] collect_kpi: 미구현, 수집 생략")
    return []


def collect_mltm() -> list[dict]:
    """
    국토부 건설공사 표준시장단가 수집
    현재: 빈 리스트 반환 (API 설정 후 구현)
    """
    print("[mltm] collect_mltm: 미구현, 수집 생략")
    return []


# ── 메인 ─────────────────────────────────────────────────────────

SOURCE_MAP = {
    "nara": collect_nara,
    "kpi":  collect_kpi,
    "mltm": collect_mltm,
}

def run(source: str):
    targets = list(SOURCE_MAP.keys()) if source == "all" else [source]
    conn = get_conn()
    try:
        for src in targets:
            print(f"\n=== [{src}] 수집 시작 {datetime.now()} ===")
            rows = SOURCE_MAP[src]()
            stat = upsert_materials(conn, rows, src)
            write_sync_log(conn, src, len(rows), **stat)
            print(f"[{src}] 완료 — total={len(rows)}, inserted={stat['inserted']}, updated={stat['updated']}, failed={stat['failed']}")
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="all", choices=["nara", "kpi", "mltm", "all"])
    args = parser.parse_args()
    run(args.source)
