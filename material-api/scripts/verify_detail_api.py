#!/usr/bin/env python3
"""
verify_detail_api.py — /api/materials/:id 단건조회 검증
실행: python3 scripts/verify_detail_api.py [BASE_URL]
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
            body = json.loads(r.read())
            return r.status, body
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        return e.code, body


def main():
    # 실제 존재하는 id 확보 (목록 첫 건)
    _, d = get("/materials?page=1&pageSize=1")
    first = d["data"]["items"][0]
    real_id = first["id"]
    print(f"테스트용 id={real_id} (code={first['code']}, name={first['name']})")
    print()

    # A. 정상 상세조회
    status, body = get(f"/materials/{real_id}")
    data = body.get("data", {})
    print("[A. 정상 상세조회]")
    print(f"  HTTP {status}")
    print(f"  id={data.get('id')}  code={data.get('code')}  name={data.get('name')}")
    print(f"  spec={data.get('spec')}  unit={data.get('unit')}  category={data.get('category')}")
    print(f"  base_price={data.get('basePrice')}  source={data.get('source')}  base_date={data.get('baseDate')}")
    print(f"  price_available={data.get('price_available')}")
    print(f"  notice={data.get('notice')}")
    print()

    # B. 없는 id 조회
    status, body = get("/materials/99999999")
    print("[B. 없는 id 조회]")
    print(f"  HTTP {status}  message={body.get('message')}")
    print()

    # C. 기존 API 영향 없음
    status, body = get("/materials?page=1&pageSize=10")
    print(f"[C1. /materials 목록] HTTP {status}  total={body['data']['total']:,}  items={len(body['data']['items'])}건")

    status, body = get("/materials/categories")
    print(f"[C2. /categories] HTTP {status}  count={len(body['data'])}개")

    status, body = get("/materials/sync-status")
    ss = body["data"]["sourceStatus"][0]
    print(f"[C3. /sync-status] HTTP {status}  nara.status={ss['status']}  priceIncluded={ss['priceIncluded']}")
    print()

    # D. health
    status, body = get("/health")
    print(f"[D. health] HTTP {status}  {body}")


if __name__ == "__main__":
    main()
