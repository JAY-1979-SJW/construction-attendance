#!/usr/bin/env python3
"""
verify_by_code_api.py — /api/materials/by-code 검증
실행: python3 scripts/verify_by_code_api.py [BASE_URL]
"""
import sys
import json
import urllib.request
import urllib.error
import urllib.parse

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://172.26.0.4:3020/api"


def get(path):
    url = BASE + path
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def main():
    # 먼저 실제 존재하는 code 1건 가져오기
    status, body = get("/materials?page=1&pageSize=1")
    sample = body["data"]["items"][0]
    real_code = sample["code"]
    real_source = sample["source"]
    print(f"[샘플 자재] code={real_code}  source={real_source}  name={sample['name']}")
    print()

    # A. 정상 조회
    code_enc = urllib.parse.quote(real_code)
    status, body = get(f"/materials/by-code?code={code_enc}")
    d = body.get("data", {})
    print(f"[A. 정상 조회]  HTTP {status}")
    if status == 200:
        print(f"  id={d['id']}  code={d['code']}  name={d['name']}")
        print(f"  spec={d.get('spec')}  unit={d.get('unit')}  category={d.get('category')}")
        print(f"  basePrice={d.get('basePrice')}  source={d.get('source')}")
        print(f"  baseDate={d.get('baseDate')}  updatedAt={d.get('updatedAt')}")
        print(f"  price_available={d.get('price_available')}  notice={d.get('notice')}")
    else:
        print(f"  오류: {body}")
    print()

    # B. source 명시 조회
    status, body = get(f"/materials/by-code?code={code_enc}&source={urllib.parse.quote(real_source)}")
    d2 = body.get("data", {})
    print(f"[B. source 명시 조회]  HTTP {status}")
    if status == 200:
        match = d2.get("id") == d.get("id")
        print(f"  id={d2.get('id')}  source={d2.get('source')}  동일 결과={match}")
    else:
        print(f"  오류: {body}")
    print()

    # C. 없는 code
    status, body = get("/materials/by-code?code=XYZNOTEXIST999999")
    print(f"[C. 없는 code]  HTTP {status}  (기대: 404)  msg={body.get('message')}")
    print()

    # D. 빈 code
    status, body = get("/materials/by-code?code=")
    print(f"[D1. 빈 code]  HTTP {status}  (기대: 400)  msg={body.get('message')}")

    status, body = get("/materials/by-code")
    print(f"[D2. code 없음]  HTTP {status}  (기대: 400)  msg={body.get('message')}")
    print()

    # E. 기존 API 영향 없음
    _, b = get("/materials?page=1&pageSize=5")
    print(f"[E1. 목록]  total={b['data']['total']:,}")

    _, b = get(f"/materials/{sample['id']}")
    print(f"[E2. id 상세]  id={b['data']['id']}")

    _, b = get("/materials/categories")
    print(f"[E3. categories]  {len(b['data'])}개")

    _, b = get("/materials/sync-status")
    print(f"[E4. sync-status]  nara.status={b['data']['sourceStatus'][0]['status']}")

    _, b = get("/materials/summary")
    print(f"[E5. summary]  total={b['data']['totalMaterials']:,}")

    q = urllib.parse.quote("철")
    _, b = get(f"/materials/suggest?q={q}")
    print(f"[E6. suggest]  {len(b['data'])}건")
    print()

    # F. health
    status, body = get("/health")
    print(f"[F. health]  HTTP {status}  {body}")


if __name__ == "__main__":
    main()
