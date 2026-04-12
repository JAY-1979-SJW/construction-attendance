#!/usr/bin/env python3
"""
collect_materials.py — 공용 자재 데이터 수집 스크립트

수집 대상:
  - nara: 나라장터 조달물가 PriceInfoService (재료 M 필터)
  - kpi : 한국물가정보 건설자재 시중단가 (미구현)
  - mltm: 건설공사 표준시장단가 국토부 (미구현)

실행:
  NARA_PRICE_API_KEY=xxx DATABASE_URL=postgresql://... python scripts/collect_materials.py --source nara
  NARA_PRICE_API_KEY=xxx DATABASE_URL=postgresql://... python scripts/collect_materials.py --source all

  --dry-run  : DB 저장 없이 수집 건수만 확인
  --pages N  : 최대 N페이지만 수집 (테스트용)

cron 예시 (월 1회 1일 03:00):
  0 3 1 * * cd ~/app/attendance/material-api && python scripts/collect_materials.py --source nara >> logs/collect.log 2>&1
"""

import argparse
import os
import sys
import json
import time
import urllib.request
from urllib.parse import urlencode
from urllib.request import urlopen
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2
    from psycopg2.extras import execute_values

DB_URL = os.environ.get("DATABASE_URL", "")

NARA_API_URL  = "https://apis.data.go.kr/1230000/ao/PriceInfoService/getNetRsceinfoList"
NARA_NUM_ROWS = 500
NARA_SLEEP    = 0.15   # 호출 간 대기 (초)
BATCH_SIZE    = 500


def get_conn():
    if not DB_URL:
        print("[ERROR] DATABASE_URL 환경변수 없음", file=sys.stderr)
        sys.exit(1)
    return psycopg2.connect(DB_URL)


def to_decimal(val) -> Decimal | None:
    if val is None or val == "":
        return None
    try:
        return Decimal(str(val))
    except InvalidOperation:
        return None


# ── DB UPSERT ────────────────────────────────────────────────────────────────

def upsert_materials(conn, rows: list[dict], source: str) -> dict:
    """
    rows: [{ code, name, spec, unit, category, sub_category, base_price, base_date }]
    UPSERT ON CONFLICT (code, source)
    """
    if not rows:
        return {"inserted": 0, "updated": 0, "failed": 0}

    sql = """
        INSERT INTO materials (code, name, spec, unit, category, sub_category, base_price, source, base_date, updated_at)
        VALUES %s
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
    """
    values = [
        (
            r["code"], r["name"], r.get("spec"), r["unit"],
            r.get("category", ""), r.get("sub_category"),
            to_decimal(r.get("base_price")),
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


# ── NARA 수집 ────────────────────────────────────────────────────────────────

def _nara_fetch_page(api_key: str, page_no: int, num_of_rows: int = NARA_NUM_ROWS):
    params = {
        "serviceKey":    api_key,
        "numOfRows":     num_of_rows,
        "pageNo":        page_no,
        "type":          "json",
        "rsceTyExtrnlCd": "M",   # 재료(Material)만
    }
    url = f"{NARA_API_URL}?{urlencode(params)}"
    try:
        with urlopen(url, timeout=45) as resp:
            raw = resp.read()
    except Exception as e:
        raise RuntimeError(f"HTTP 오류: {e}")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"JSON 파싱 오류: {e} | 원문: {raw[:200]}")

    try:
        body  = data["response"]["body"]
        total = int(body.get("totalCount", 0))
        items = body.get("items", [])
        if isinstance(items, dict):
            items = items.get("item", [])
        if isinstance(items, dict):
            items = [items]
        return total, items or []
    except (KeyError, TypeError) as e:
        raise RuntimeError(f"응답 구조 오류: {e} | 응답: {str(data)[:300]}")


def _nara_normalize(item: dict, base_date: date) -> dict | None:
    code = (item.get("netRsceCd") or "").strip()
    name = (item.get("rsceNm") or "").strip()
    if not code or not name:
        return None
    return {
        "code":         code,
        "name":         name,
        "spec":         (item.get("rsceSpecNm") or "").strip() or None,
        "unit":         (item.get("unit") or "").strip(),
        "category":     (item.get("lvlRsceClsfcNm1") or "").strip(),
        "sub_category": (item.get("lvlRsceClsfcNm2") or "").strip() or None,
        "base_price":   item.get("lbrcst"),
        "base_date":    base_date,
    }


def collect_nara(max_pages: int = 0) -> list[dict]:
    """
    나라장터 PriceInfoService 재료(M) 전체 수집
    - NARA_PRICE_API_KEY 또는 G2B_PRICE_API_KEY 환경변수 필요
    - max_pages > 0 이면 해당 페이지 수까지만 수집 (테스트용)
    """
    api_key = os.environ.get("NARA_PRICE_API_KEY") or os.environ.get("G2B_PRICE_API_KEY")
    if not api_key:
        print("[nara] NARA_PRICE_API_KEY 환경변수 없음 — 수집 생략", file=sys.stderr)
        return []

    # base_date: 이번 달 1일 (조달물가 기준)
    today      = date.today()
    base_date  = today.replace(day=1)
    rows: list[dict] = []
    error_pages: list[int] = []

    # 1페이지 → totalCount 파악
    print(f"[nara] 1페이지 조회 중...", flush=True)
    try:
        total, first_items = _nara_fetch_page(api_key, 1)
    except Exception as e:
        print(f"[nara] 1페이지 호출 실패: {e}", file=sys.stderr)
        return []

    total_pages = (total + NARA_NUM_ROWS - 1) // NARA_NUM_ROWS
    if max_pages > 0:
        total_pages = min(total_pages, max_pages)

    print(f"[nara] API 총 {total:,}건 (재료M) / {total_pages}페이지 수집 예정", flush=True)

    for item in first_items:
        row = _nara_normalize(item, base_date)
        if row:
            rows.append(row)

    for page_no in range(2, total_pages + 1):
        for attempt in range(3):
            try:
                _, items = _nara_fetch_page(api_key, page_no)
                for item in items:
                    row = _nara_normalize(item, base_date)
                    if row:
                        rows.append(row)
                break
            except Exception as e:
                if attempt == 2:
                    print(f"  [실패] p{page_no}: {e}", file=sys.stderr)
                    error_pages.append(page_no)
                else:
                    print(f"  [재시도 {attempt+1}/3] p{page_no}: {e}", flush=True)
                    time.sleep(3)

        if page_no % 20 == 0:
            print(f"  p{page_no}/{total_pages} — {len(rows):,}건 누적", flush=True)

        time.sleep(NARA_SLEEP)

    print(
        f"[nara] 수집 완료 — {len(rows):,}건 "
        f"(실패 페이지: {len(error_pages)}개{': '+str(error_pages[:10]) if error_pages else ''})",
        flush=True,
    )
    return rows


# ── KPI / MLTM 스텁 ──────────────────────────────────────────────────────────

def collect_kpi(max_pages: int = 0) -> list[dict]:
    """한국물가정보(KPI) 건설자재 시중단가 — 미구현"""
    print("[kpi] 미구현 — 수집 생략")
    return []


def collect_mltm(max_pages: int = 0) -> list[dict]:
    """국토부 건설공사 표준시장단가 — 미구현"""
    print("[mltm] 미구현 — 수집 생략")
    return []


# ── 메인 ─────────────────────────────────────────────────────────────────────

SOURCE_MAP = {
    "nara": collect_nara,
    "kpi":  collect_kpi,
    "mltm": collect_mltm,
}


def run(source: str, dry_run: bool = False, max_pages: int = 0):
    targets = list(SOURCE_MAP.keys()) if source == "all" else [source]
    conn = None if dry_run else get_conn()

    try:
        for src in targets:
            print(f"\n=== [{src}] 수집 시작 {datetime.now():%Y-%m-%d %H:%M:%S} ===", flush=True)
            rows = SOURCE_MAP[src](max_pages=max_pages)

            if dry_run:
                print(f"[{src}] dry-run — 수집 {len(rows):,}건 (DB 미저장)")
                if rows:
                    print(f"  샘플 3건:")
                    for r in rows[:3]:
                        print(f"    {r}")
                continue

            stat = upsert_materials(conn, rows, src)
            note = f"max_pages={max_pages}" if max_pages else None
            write_sync_log(conn, src, len(rows), **stat, note=note)
            print(
                f"[{src}] 완료 — "
                f"total={len(rows):,} inserted={stat['inserted']:,} "
                f"updated={stat['updated']:,} failed={stat['failed']:,}",
                flush=True,
            )
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source",    default="all", choices=["nara", "kpi", "mltm", "all"])
    parser.add_argument("--dry-run",   action="store_true", help="DB 저장 없이 수집 건수만 확인")
    parser.add_argument("--pages",     type=int, default=0,  help="최대 페이지 수 (0=전체)")
    args = parser.parse_args()
    run(args.source, dry_run=args.dry_run, max_pages=args.pages)
