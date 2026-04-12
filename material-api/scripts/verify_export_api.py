#!/usr/bin/env python3
"""
verify_export_api.py — /api/materials/export.csv 검증
실행: python3 scripts/verify_export_api.py [BASE_URL]
"""
import sys
import json
import urllib.request
import urllib.error
import urllib.parse

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://172.26.0.4:3020/api"


def get_csv(path):
    url = BASE + path
    with urllib.request.urlopen(url, timeout=60) as r:
        raw = r.read()
        headers = dict(r.headers)
        return headers, raw.decode("utf-8-sig")  # BOM 제거


def get_json(path):
    url = BASE + path
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def check_csv(label, path):
    headers, content = get_csv(path)
    lines = [l for l in content.strip().split("\n") if l]
    header_cols = lines[0].split(",")
    data_rows = lines[1:]
    print(f"[{label}]")
    print(f"  Content-Type: {headers.get('Content-Type', headers.get('content-type'))}")
    print(f"  Content-Disposition: {headers.get('Content-Disposition', headers.get('content-disposition'))}")
    print(f"  컬럼: {header_cols}")
    print(f"  데이터 행수: {len(data_rows):,}건")
    if data_rows:
        print(f"  첫 행 샘플: {data_rows[0][:120]}")
    print()


def main():
    # A. 기본 전체 CSV
    check_csv("A. 기본 전체", "/materials/export.csv")

    # B. q=철근 CSV
    q = urllib.parse.quote("철근")
    check_csv(f"B. q=철근", f"/materials/export.csv?q={q}")

    # C. category=건자재 CSV
    cat = urllib.parse.quote("건자재")
    check_csv(f"C. category=건자재", f"/materials/export.csv?category={cat}")

    # D. 기존 API 영향 없음
    status, body = get_json("/materials?page=1&pageSize=10")
    print(f"[D1. 목록] HTTP {status}  total={body['data']['total']:,}")

    status, body = get_json("/materials/33934")
    print(f"[D2. 상세] HTTP {status}  id={body['data']['id']}")

    status, body = get_json("/materials/categories")
    print(f"[D3. categories] HTTP {status}  count={len(body['data'])}개")

    status, body = get_json("/materials/sync-status")
    print(f"[D4. sync-status] HTTP {status}  nara.status={body['data']['sourceStatus'][0]['status']}")

    status, body = get_json("/materials/summary")
    print(f"[D5. summary] HTTP {status}  total={body['data']['totalMaterials']:,}")
    print()

    # E. health
    status, body = get_json("/health")
    print(f"[E. health] HTTP {status}  {body}")


if __name__ == "__main__":
    main()
