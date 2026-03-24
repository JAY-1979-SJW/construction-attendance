#!/usr/bin/env python3
"""
나라장터 getCnsttyClsfcInfoList 전체 수집 → PostgreSQL nara_construction_class 저장
실행: python3 scripts/collect_nara_construction_class.py

- 공종분류 및 세부공종 44,744건
- numOfRows=100 기준 ~448페이지
- TRUNCATE + INSERT (재실행 안전)
"""
import sys
import time
import json
import argparse
from urllib.request import urlopen
from urllib.parse import urlencode
from urllib.error import URLError, HTTPError
from datetime import datetime

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2
    import psycopg2.extras

# ─── 설정 ────────────────────────────────────────────────────────────────────

API_KEY = "__REVOKED__"
API_URL = "http://apis.data.go.kr/1230000/ao/PriceInfoService/getCnsttyClsfcInfoList"

DB_DSN = (
    "host=192.168.120.18 port=5432 dbname=construction_attendance "
    "user=attendance_app password=Att3nd4nce@Haehan2026"
)

NUM_OF_ROWS = 100
SLEEP_SEC   = 0.2
BATCH_SIZE  = 300

# ─── API 호출 ─────────────────────────────────────────────────────────────────

def fetch_page(page_no: int):
    params = {
        "serviceKey": API_KEY,
        "numOfRows":  NUM_OF_ROWS,
        "pageNo":     page_no,
        "type":       "json",
    }
    url = f"{API_URL}?{urlencode(params)}"
    try:
        with urlopen(url, timeout=45) as resp:
            raw = resp.read()
    except Exception as e:
        raise RuntimeError(f"HTTP 오류: {e}")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"JSON 파싱 오류: {e}")

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
        raise RuntimeError(f"응답 구조 오류: {e}")

# ─── DB 저장 ──────────────────────────────────────────────────────────────────

def insert_batch(cur, rows: list[tuple]) -> None:
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO nara_construction_class
          (cnstwk_div_cd, cnstwk_div_nm,
           lvl1_cd, lvl1_nm, lvl1_dscrpt,
           lvl2_cd, lvl2_nm, lvl2_dscrpt,
           lvl3_cd, lvl3_nm, lvl3_dscrpt,
           lvl4_cd, lvl4_nm, lvl4_dscrpt,
           lvl5_cd, lvl5_nm, lvl5_dscrpt,
           qty_calc_cd, qty_calc_nm,
           spec, unit, dscrpt, spectn_yn, collected_at)
        VALUES %s
        """,
        rows,
        template=(
            "(%s,%s, %s,%s,%s, %s,%s,%s, %s,%s,%s, %s,%s,%s, %s,%s,%s,"
            " %s,%s, %s,%s,%s,%s, NOW())"
        ),
        page_size=300,
    )

def s(item, key):
    v = item.get(key, "") or ""
    return v.strip() or None

# ─── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-page", type=int, default=1)
    args = parser.parse_args()
    start_page = args.start_page

    start = datetime.now()
    print(f"[{start:%H:%M:%S}] 공종분류 수집 시작 (start-page={start_page})", flush=True)

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur  = conn.cursor()

    if start_page == 1:
        cur.execute("TRUNCATE TABLE nara_construction_class RESTART IDENTITY")
        conn.commit()
        print("  기존 데이터 초기화 완료", flush=True)

    total, first_items = fetch_page(1)
    total_pages = (total + NUM_OF_ROWS - 1) // NUM_OF_ROWS
    print(f"  총 {total:,}건 / {total_pages}페이지 수집 예정", flush=True)

    all_rows: list[tuple] = []
    error_pages: list[int] = []

    def flush_rows():
        if all_rows:
            insert_batch(cur, all_rows)
            conn.commit()
            all_rows.clear()

    def add_items(items):
        for it in items:
            all_rows.append((
                s(it, "cnstwkDivCd"), s(it, "cnstwkDivNm"),
                s(it, "LvlqtyCalcCtyclCd1"), s(it, "LvlqtyCalcCtyclNm1"), s(it, "LvlqtyCalcCtyclDscrpt1"),
                s(it, "LvlqtyCalcCtyclCd2"), s(it, "LvlqtyCalcCtyclNm2"), s(it, "LvlqtyCalcCtyclDscrpt2"),
                s(it, "LvlqtyCalcCtyclCd3"), s(it, "LvlqtyCalcCtyclNm3"), s(it, "LvlqtyCalcCtyclDscrpt3"),
                s(it, "LvlqtyCalcCtyclCd4"), s(it, "LvlqtyCalcCtyclNm4"), s(it, "LvlqtyCalcCtyclDscrpt4"),
                s(it, "LvlqtyCalcCtyclCd5"), s(it, "LvlqtyCalcCtyclNm5"), s(it, "LvlqtyCalcCtyclDscrpt5"),
                s(it, "qtyCalcCtyclcd"), s(it, "qtyCalcCtyclNm"),
                s(it, "spec"), s(it, "unit"), s(it, "dscrpt"), s(it, "SpectnYn"),
            ))
        if len(all_rows) >= BATCH_SIZE:
            flush_rows()

    if start_page == 1:
        add_items(first_items)

    for page_no in range(max(2, start_page), total_pages + 1):
        retry = 0
        while retry < 3:
            try:
                _, items = fetch_page(page_no)
                add_items(items)
                break
            except Exception as e:
                retry += 1
                print(f"  [재시도 {retry}/3] p{page_no}: {e}", flush=True)
                time.sleep(3)
        else:
            print(f"  [실패] p{page_no} — 건너뜀", flush=True)
            error_pages.append(page_no)

        if page_no % 50 == 0:
            flush_rows()
            cur.execute("SELECT COUNT(*) FROM nara_construction_class")
            cnt = cur.fetchone()[0]
            elapsed = (datetime.now() - start).seconds
            print(f"  p{page_no}/{total_pages} — DB {cnt:,}건 ({elapsed}s)", flush=True)

        time.sleep(SLEEP_SEC)

    flush_rows()

    # ─── 최종 검증 ────────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM nara_construction_class")
    db_total = cur.fetchone()[0]

    cur.execute("""
        SELECT cnstwk_div_cd, cnstwk_div_nm, COUNT(*) AS cnt
        FROM nara_construction_class GROUP BY 1,2 ORDER BY 1
    """)
    by_div = cur.fetchall()

    elapsed = (datetime.now() - start).seconds
    print(f"\n=== 수집 완료 ({elapsed}s) ===")
    print(f"API 총: {total:,}건 / DB 적재: {db_total:,}건")
    print("\n[공사구분별]")
    for row in by_div:
        print(f"  {row[0]} {row[1]}: {row[2]:,}건")

    if error_pages:
        print(f"\n[실패 페이지] {len(error_pages)}개: {error_pages[:20]}")
    else:
        print("\n[실패 페이지] 없음")

    cur.close()
    conn.close()
    print("완료.", flush=True)


if __name__ == "__main__":
    main()
