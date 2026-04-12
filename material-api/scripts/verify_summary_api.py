#!/usr/bin/env python3
"""
verify_summary_api.py — /api/materials/summary 검증
실행: python3 scripts/verify_summary_api.py [BASE_URL]
"""
import sys
import json
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://172.26.0.4:3020/api"


def get(path, expect_status=200):
    url = BASE + path
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def main():
    # A. summary
    status, body = get("/materials/summary")
    d = body["data"]
    print("[A. summary]")
    print(f"  HTTP {status}")
    print(f"  totalMaterials={d['totalMaterials']:,}")
    print(f"  totalCategories={d['totalCategories']}")
    print(f"  sourceCounts={d['sourceCounts']}")
    print(f"  priceAvailableCount={d['priceAvailableCount']:,}")
    print(f"  priceMissingCount={d['priceMissingCount']:,}")
    print(f"  latestBaseDate={d['latestBaseDate']}")
    print(f"  price_available={d['price_available']}")
    print(f"  notice={d['notice']}")
    print(f"  categoryTop10 ({len(d['categoryTop10'])}개):")
    for c in d["categoryTop10"]:
        print(f"    {c['category']}: {c['count']:,}건")
    print()

    # B. 기존 API 영향 없음
    status, body = get("/materials?page=1&pageSize=10")
    d2 = body["data"]
    print(f"[B1. 목록] HTTP {status}  total={d2['total']:,}  items={len(d2['items'])}건")

    status, body = get("/materials/33934")
    print(f"[B2. 상세] HTTP {status}  id={body['data']['id']}  name={body['data']['name']}")

    status, body = get("/materials/categories")
    print(f"[B3. categories] HTTP {status}  count={len(body['data'])}개")

    status, body = get("/materials/sync-status")
    ss = body["data"]["sourceStatus"][0]
    print(f"[B4. sync-status] HTTP {status}  nara.status={ss['status']}")
    print()

    # C. health
    status, body = get("/health")
    print(f"[C. health] HTTP {status}  {body}")


if __name__ == "__main__":
    main()
