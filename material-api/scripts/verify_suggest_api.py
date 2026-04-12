#!/usr/bin/env python3
"""
verify_suggest_api.py — /api/materials/suggest 검증
실행: python3 scripts/verify_suggest_api.py [BASE_URL]
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


def check_suggest(label, path, show_priority=False):
    status, body = get(path)
    items = body.get("data", [])
    print(f"[{label}]  HTTP {status}  결과={len(items)}건")
    for it in items[:5]:
        print(f"  id={it['id']}  code={it['code']}  name={it['name']}  category={it['category']}")
    if show_priority and items:
        q_raw = path.split("q=")[1].split("&")[0] if "q=" in path else ""
        q = urllib.parse.unquote(q_raw).lower()
        for it in items[:3]:
            cp = it["code"].lower().startswith(q)
            np = it["name"].lower().startswith(q)
            tag = "code-prefix" if cp else ("name-prefix" if np else "contains")
            print(f"    → {tag}: {it['code']} / {it['name']}")
    print()


def main():
    # A. 기본 자동완성
    q = urllib.parse.quote("철")
    check_suggest("A. q=철 (limit=10 기본)", f"/materials/suggest?q={q}")

    # B. 코드 prefix
    code_prefix = "391317"
    check_suggest("B. q=코드prefix(391317)", f"/materials/suggest?q={code_prefix}", show_priority=True)

    # C. q + category 조합
    q2 = urllib.parse.quote("파이프")
    cat = urllib.parse.quote("배관유체조절시스템장비및부품")
    check_suggest("C. q=파이프 + category=배관...", f"/materials/suggest?q={q2}&category={cat}")

    # D. 예외 처리
    status, body = get("/materials/suggest")
    print(f"[D1. q 없음]  결과={len(body.get('data', []))}건  (기대: 0)")

    status, body = get("/materials/suggest?q=xyznotexist999")
    print(f"[D2. 없는 검색어]  결과={len(body.get('data', []))}건  (기대: 0)")

    status, body = get(f"/materials/suggest?q={urllib.parse.quote('철')}&limit=99")
    print(f"[D3. limit=99 → max 20]  결과={len(body.get('data', []))}건  (기대: ≤20)")
    print()

    # E. 기존 API 영향
    _, b = get("/materials?page=1&pageSize=5")
    print(f"[E1. 목록]  total={b['data']['total']:,}")
    _, b = get("/materials/33934")
    print(f"[E2. 상세]  id={b['data']['id']}")
    _, b = get("/materials/categories")
    print(f"[E3. categories]  {len(b['data'])}개")
    _, b = get("/materials/sync-status")
    print(f"[E4. sync-status]  nara.status={b['data']['sourceStatus'][0]['status']}")
    _, b = get("/materials/summary")
    print(f"[E5. summary]  total={b['data']['totalMaterials']:,}")
    _, b = get("/materials/export.csv")  # 빠른 확인은 생략, 헤더만
    print(f"[E6. export.csv]  success={b if isinstance(b, dict) else 'binary ok'}")
    print()

    # F. health
    status, body = get("/health")
    print(f"[F. health]  HTTP {status}  {body}")


if __name__ == "__main__":
    main()
