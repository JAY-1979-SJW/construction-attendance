#!/usr/bin/env python3
"""
verify_materials_api.py — materials API 조회 검증
실행: python3 scripts/verify_materials_api.py [BASE_URL]
기본: http://172.26.0.4:3020/api
"""
import sys
import json
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://172.26.0.4:3020/api"


def get(path):
    url = BASE + path
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())


def print_list(label, path):
    d = get(path)
    data = d["data"]
    total      = data["total"]
    page       = data["page"]
    page_size  = data["pageSize"]
    total_pages= data["totalPages"]
    items      = data["items"]
    notice     = data.get("notice", "")
    price_avail= data.get("price_available")
    print(f"[{label}]")
    print(f"  total={total:,}  page={page}  pageSize={page_size}  totalPages={total_pages}")
    print(f"  price_available={price_avail}")
    print(f"  notice={notice[:60]}...")
    print(f"  items 반환={len(items)}건")
    for it in items[:2]:
        print(f"    {it['code']} | {it['name']} | {it['category']}")
    print()


def main():
    # A. 기본 조회
    print_list("A. 기본(page=1,pageSize=50)", "/materials?page=1&pageSize=50")

    # B. q 코드 검색
    print_list("B1. q=코드(5611)", "/materials?q=5611")

    # B2. q 이름 검색
    print_list("B2. q=이름(철근)", "/materials?q=%EC%B2%A0%EA%B7%BC")

    # C1. category 필터 (존재)
    print_list("C1. category=건자재", "/materials?category=%EA%B1%B4%EC%9E%90%EC%9E%AC&pageSize=5")

    # C2. category 필터 (없는 값)
    print_list("C2. category=없는카테고리xyz", "/materials?category=%EC%97%86%EB%8A%94%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%ACxyz")

    # D. 조합 (q + category + page)
    print_list(
        "D. 조합(q=파이프, category=배관유체조절시스템장비및부품, page=1, pageSize=10)",
        "/materials?q=%ED%8C%8C%EC%9D%B4%ED%94%84&category=%EB%B0%B0%EA%B4%80%EC%9C%A0%EC%B2%B4%EC%A1%B0%EC%A0%88%EC%8B%9C%EC%8A%A4%ED%85%9C%EC%9E%A5%EB%B9%84%EB%B0%8F%EB%B6%80%ED%92%88&page=1&pageSize=10"
    )

    # E. sync-status
    d = get("/materials/sync-status")["data"]
    ss = d["sourceStatus"][0]
    print("[E. sync-status]")
    print(f"  totalMaterials={d['totalMaterials']:,}")
    print(f"  nara.status={ss['status']}")
    print(f"  nara.dataType={ss['dataType']}")
    print(f"  nara.baseDate={ss['baseDate']}")
    print(f"  nara.priceIncluded={ss['priceIncluded']}")
    print(f"  nara.lastLiveSync={ss['lastLiveSync']}")
    print()

    # F. categories
    d = get("/materials/categories")["data"]
    print(f"[F. categories] count={len(d)}개")
    for c in d[:5]:
        print(f"  {c['category']}: {c['count']:,}건")
    print()

    # G. health
    d = get("/health")
    print(f"[G. health] {d}")


if __name__ == "__main__":
    main()
