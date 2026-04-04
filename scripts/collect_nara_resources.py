#!/usr/bin/env python3
"""
나라장터 getNetRsceinfoList 전체 수집 → PostgreSQL nara_resources 저장
실행: python3 scripts/collect_nara_resources.py

- 공종 구분 없이 전체 수집 (E경비/L노무/M재료)
- numOfRows=500 기준 ~118페이지
- TRUNCATE + INSERT (재실행 안전)
- 수집 완료 후 유형별·대분류별 집계 출력
"""
import os
import sys
import time
import json
import argparse
from urllib.request import urlopen
from urllib.parse import urlencode
from urllib.error import URLError, HTTPError
from decimal import Decimal, InvalidOperation
from datetime import datetime

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 설치 중...", flush=True)
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2
    import psycopg2.extras

# ─── 설정 ────────────────────────────────────────────────────────────────────

API_KEY = "__REVOKED__"
API_URL = "http://apis.data.go.kr/1230000/ao/PriceInfoService/getNetRsceinfoList"

_db_pw = os.environ.get("DB_PASSWORD") or os.environ.get("PGPASSWORD")
if not _db_pw:
    raise RuntimeError("DB_PASSWORD 환경변수 미설정 — 실행 전 설정 필요")
_db_host = os.environ.get("DB_HOST", "192.168.120.18")
DB_DSN = (
    f"host={_db_host} port=5432 dbname=construction_attendance "
    f"user=attendance_app password={_db_pw}"
)

NUM_OF_ROWS = 500
SLEEP_SEC   = 0.15   # API 호출 간 대기
BATCH_SIZE  = 500    # DB INSERT 배치 크기

# ─── API 호출 ─────────────────────────────────────────────────────────────────

def fetch_page(page_no: int, num_of_rows: int = NUM_OF_ROWS):
    params = {
        "serviceKey": API_KEY,
        "numOfRows":  num_of_rows,
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
        raise RuntimeError(f"JSON 파싱 오류: {e}\n원문: {raw[:200]}")

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
        raise RuntimeError(f"응답 구조 오류: {e}\n응답: {str(data)[:300]}")

# ─── DB 저장 ──────────────────────────────────────────────────────────────────

def insert_batch(cur, rows: list[tuple]) -> None:
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO nara_resources
          (rsce_ty_extrnl_cd, lvl_rsce_clsfc_nm1, lvl_rsce_clsfc_nm2,
           net_rsce_cd, rsce_nm, rsce_spec_nm, unit, lbrcst, collected_at)
        VALUES %s
        """,
        rows,
        template="(%s, %s, %s, %s, %s, %s, %s, %s, NOW())",
        page_size=500,
    )

def to_decimal(val) -> Decimal | None:
    if val is None or val == "":
        return None
    try:
        return Decimal(str(val))
    except InvalidOperation:
        return None

# ─── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-page", type=int, default=1,
                        help="시작 페이지 (재개 시 사용, TRUNCATE 건너뜀)")
    args = parser.parse_args()
    start_page = args.start_page

    start = datetime.now()
    print(f"[{start:%H:%M:%S}] 수집 시작 (start-page={start_page})", flush=True)

    # DB 연결
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur  = conn.cursor()

    if start_page == 1:
        cur.execute("TRUNCATE TABLE nara_resources RESTART IDENTITY")
        conn.commit()
        print("  기존 데이터 초기화 완료", flush=True)

    # 1페이지 조회 → totalCount 파악
    total, first_items = fetch_page(1)
    total_pages = (total + NUM_OF_ROWS - 1) // NUM_OF_ROWS
    print(f"  총 {total:,}건 / {total_pages}페이지 수집 예정", flush=True)

    # 수집 루프
    all_rows: list[tuple] = []
    error_pages: list[int] = []

    def flush_rows():
        if all_rows:
            insert_batch(cur, all_rows)
            conn.commit()
            all_rows.clear()

    def add_items(items):
        for item in items:
            all_rows.append((
                item.get("rsceTyExtrnlCd") or None,
                item.get("lvlRsceClsfcNm1") or None,
                item.get("lvlRsceClsfcNm2") or None,
                item.get("netRsceCd")       or None,
                item.get("rsceNm")          or None,
                item.get("rsceSpecNm")      or None,
                item.get("unit")            or None,
                to_decimal(item.get("lbrcst")),
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

        if page_no % 20 == 0:
            flush_rows()
            cur.execute("SELECT COUNT(*) FROM nara_resources")
            cnt = cur.fetchone()[0]
            elapsed = (datetime.now() - start).seconds
            print(f"  p{page_no}/{total_pages} — DB {cnt:,}건 ({elapsed}s)", flush=True)

        time.sleep(SLEEP_SEC)

    flush_rows()

    # ─── 최종 검증 ────────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM nara_resources")
    db_total = cur.fetchone()[0]

    cur.execute("""
        SELECT rsce_ty_extrnl_cd, COUNT(*) AS cnt
        FROM nara_resources GROUP BY 1 ORDER BY 2 DESC
    """)
    by_type = cur.fetchall()

    cur.execute("""
        SELECT lvl_rsce_clsfc_nm1, COUNT(*) AS cnt
        FROM nara_resources GROUP BY 1 ORDER BY 2 DESC LIMIT 10
    """)
    by_cat = cur.fetchall()

    elapsed = (datetime.now() - start).seconds
    print(f"\n=== 수집 완료 ({elapsed}s) ===")
    print(f"API 총: {total:,}건 / DB 적재: {db_total:,}건")

    print("\n[유형별]")
    for row in by_type:
        print(f"  {row[0] or 'N/A'}({row[0] and {'E':'경비','L':'노무','M':'재료'}.get(row[0],'?') or '?'}): {row[1]:,}건")

    print("\n[대분류 상위 10]")
    for row in by_cat:
        print(f"  {row[0] or 'N/A'}: {row[1]:,}건")

    if error_pages:
        print(f"\n[실패 페이지] {len(error_pages)}개: {error_pages[:20]}")
    else:
        print("\n[실패 페이지] 없음")

    cur.close()
    conn.close()
    print("완료.", flush=True)


if __name__ == "__main__":
    main()
