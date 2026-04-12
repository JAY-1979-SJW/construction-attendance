#!/usr/bin/env python3
"""
verify_material_api_core.py — material-api 핵심 API 스모크 검증
실행: python3 scripts/verify_material_api_core.py [BASE_URL]
기본: http://172.26.0.4:3020
"""
import sys
import json
import urllib.request
import urllib.error

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://172.26.0.4:3020").rstrip("/")
API  = BASE + "/api"

PASS_STR = "PASS"
FAIL_STR = "FAIL"
WARN_STR = "WARN"

results = []


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def http_get(url, timeout=10):
    """(status, body_bytes, headers)"""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), {}
    except Exception as e:
        return 0, b"", {}

def http_post(url, body_dict, timeout=10):
    data = json.dumps(body_dict).encode()
    req  = urllib.request.Request(url, data=data,
                                   headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), {}
    except Exception as e:
        return 0, b"", {}

def record(name, ok, detail):
    status = PASS_STR if ok else FAIL_STR
    results.append((name, status, detail))
    tag = f"[{status}]"
    print(f"  {tag:<7} {name:<45} {detail}")


# ── 검증 항목 ──────────────────────────────────────────────────────────────────

print(f"\n{'='*70}")
print(f"  material-api core smoke  BASE={BASE}")
print(f"{'='*70}")

# 1. GET /health
status, body, _ = http_get(f"{BASE}/health")
ok = status == 200
record("GET /health", ok, f"HTTP {status}")

# 2. GET /api/materials?page=1&pageSize=10
status, body, _ = http_get(f"{API}/materials?page=1&pageSize=10")
try:
    d = json.loads(body)
    total = d["data"]["total"]
    price_avail = d["data"].get("price_available")
    ok = status == 200 and isinstance(total, int) and price_avail is False
    detail = f"HTTP {status} total={total} price_available={price_avail}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("GET /api/materials?pageSize=10", ok, detail)

# 3. GET /api/materials/:id — id=1 고정 사용
status, body, _ = http_get(f"{API}/materials/1")
try:
    d = json.loads(body)
    ok = status == 200 and "id" in d["data"]
    detail = f"HTTP {status} id={d['data'].get('id')} code={d['data'].get('code','')[:20]}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("GET /api/materials/1", ok, detail)

# 4. GET /api/materials/by-code?code=3913170620174408
CODE = "3913170620174408"
status, body, _ = http_get(f"{API}/materials/by-code?code={CODE}")
try:
    d = json.loads(body)
    ok = status == 200 and d["data"].get("code") == CODE
    detail = f"HTTP {status} code={d['data'].get('code','')}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("GET /api/materials/by-code", ok, detail)

# 5. POST /api/materials/lookup
status, body, _ = http_post(f"{API}/materials/lookup",
                             {"codes": [CODE, "3913170620174409", "NOTEXIST_ZZZ"]})
try:
    d = json.loads(body)
    data = d["data"]
    ok = (status == 200
          and data["requestedCount"] == 3
          and data["foundCount"] == 2
          and data["missingCodes"] == ["NOTEXIST_ZZZ"])
    detail = f"HTTP {status} req={data['requestedCount']} found={data['foundCount']} missing={data['missingCodes']}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("POST /api/materials/lookup", ok, detail)

# 6. POST /api/materials/lookup/export.csv
status, body, headers = http_post(f"{API}/materials/lookup/export.csv",
                                   {"codes": [CODE, "NOTEXIST_ZZZ"]})
try:
    ctype = headers.get("Content-Type", "")
    bom   = body[:3] == b'\xef\xbb\xbf'
    lines = body.decode("utf-8-sig").strip().split("\n")
    header_ok = lines[0].startswith("input_code,found")
    ok = status == 200 and "text/csv" in ctype and bom and header_ok and len(lines) == 3
    detail = f"HTTP {status} csv rows(incl header)={len(lines)} BOM={bom} header_ok={header_ok}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("POST /api/materials/lookup/export.csv", ok, detail)

# 7. POST /api/materials/lookup/text
status, body, _ = http_post(f"{API}/materials/lookup/text",
                             {"text": f"{CODE}\n3913170620174409\nNOTEXIST_ZZZ"})
try:
    d = json.loads(body)
    data = d["data"]
    ok = (status == 200
          and data["requestedCount"] == 3
          and data["foundCount"] == 2
          and "NOTEXIST_ZZZ" in data["missingCodes"])
    detail = f"HTTP {status} req={data['requestedCount']} found={data['foundCount']} missing={data['missingCodes']}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("POST /api/materials/lookup/text", ok, detail)

# 8. POST /api/materials/lookup/text/export.csv
status, body, headers = http_post(f"{API}/materials/lookup/text/export.csv",
                                   {"text": f"{CODE}\n3913170620174409\nNOTEXIST_ZZZ"})
try:
    ctype = headers.get("Content-Type", "")
    bom   = body[:3] == b'\xef\xbb\xbf'
    lines = body.decode("utf-8-sig").strip().split("\n")
    header_ok = lines[0].startswith("input_code,found")
    # NOTEXIST_ZZZ 행은 found=false
    missing_row = any("NOTEXIST_ZZZ,false" in l for l in lines)
    ok = status == 200 and "text/csv" in ctype and bom and header_ok and len(lines) == 4 and missing_row
    detail = f"HTTP {status} rows={len(lines)} BOM={bom} missing_row={missing_row}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("POST /api/materials/lookup/text/export.csv", ok, detail)

# 9. GET /api/materials/categories
status, body, _ = http_get(f"{API}/materials/categories")
try:
    d = json.loads(body)
    count = len(d["data"])
    ok = status == 200 and count > 0
    detail = f"HTTP {status} categories={count}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("GET /api/materials/categories", ok, detail)

# 10. GET /api/materials/summary
status, body, _ = http_get(f"{API}/materials/summary")
try:
    d = json.loads(body)
    data = d["data"]
    ok = (status == 200
          and isinstance(data.get("totalMaterials"), int)
          and data.get("price_available") is False)
    detail = f"HTTP {status} total={data.get('totalMaterials')} price_available={data.get('price_available')}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("GET /api/materials/summary", ok, detail)

# 11. GET /api/materials/sync-status (nara.status=deferred 유지 확인)
status, body, _ = http_get(f"{API}/materials/sync-status")
try:
    d = json.loads(body)
    data = d["data"]
    nara = next((s for s in data.get("sourceStatus", []) if s["source"] == "nara"), None)
    nara_deferred = nara is not None and nara.get("status") == "deferred"
    ok = status == 200 and nara_deferred
    detail = f"HTTP {status} total={data.get('totalMaterials')} nara.status={nara.get('status') if nara else 'N/A'}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("GET /api/materials/sync-status (nara deferred)", ok, detail)

# 12. GET /api/materials/suggest?q=3913
status, body, _ = http_get(f"{API}/materials/suggest?q=3913")
try:
    d = json.loads(body)
    count = len(d["data"])
    ok = status == 200 and count > 0
    detail = f"HTTP {status} suggest count={count}"
except Exception:
    ok = False
    detail = f"HTTP {status} parse error"
record("GET /api/materials/suggest?q=3913", ok, detail)


# ── 결과 요약 ─────────────────────────────────────────────────────────────────

total   = len(results)
passed  = sum(1 for _, s, _ in results if s == PASS_STR)
failed  = total - passed
final   = PASS_STR if failed == 0 else FAIL_STR

print(f"\n{'='*70}")
print(f"  total={total}  passed={passed}  failed={failed}  → {final}")
print(f"{'='*70}\n")

sys.exit(0 if failed == 0 else 1)
