"""Validate Kakao auth environment variables in .env.local — no secret values in output."""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENV_FILE = REPO / ".env.local"
RUNS_DIR = REPO / "runs" / "auth"

NEXTAUTH_URL_EXPECTED = "https://attendance.haehan-ai.kr"
REDIRECT_URI_EXPECTED = f"{NEXTAUTH_URL_EXPECTED}/api/auth/callback/kakao"


def load_env(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    if not path.exists():
        return result
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip()
    return result


def check_no_raw_secrets(data: dict) -> bool:
    """Verify the result dict contains no raw key/secret values."""
    import re
    _HEX32 = re.compile(r'[0-9a-f]{32}')
    _LONG_TOKEN = re.compile(r'[A-Za-z0-9+/=_\-]{48,}')
    dumped = json.dumps(data)
    if _HEX32.search(dumped):
        return False
    if _LONG_TOKEN.search(dumped):
        return False
    return True


def run(output_json: bool = False) -> dict:
    env = load_env(ENV_FILE)

    cid = env.get("KAKAO_CLIENT_ID", "")
    cs = env.get("KAKAO_CLIENT_SECRET", "")
    url = env.get("NEXTAUTH_URL", "")
    ns = env.get("NEXTAUTH_SECRET", "") or env.get("AUTH_SECRET", "")

    calculated_redirect_uri = f"{url}/api/auth/callback/kakao" if url else ""
    redirect_uri_match = calculated_redirect_uri == REDIRECT_URI_EXPECTED

    checks = {
        "KAKAO_CLIENT_ID_present": bool(cid),
        "KAKAO_CLIENT_ID_length": len(cid),
        "KAKAO_CLIENT_SECRET_present": bool(cs),
        "KAKAO_CLIENT_SECRET_length": len(cs),
        "NEXTAUTH_URL": url,
        "NEXTAUTH_URL_correct": url == NEXTAUTH_URL_EXPECTED,
        "NEXTAUTH_SECRET_present": bool(ns),
        "NEXTAUTH_SECRET_length": len(ns),
        "NEXTAUTH_SECRET_min32": len(ns) >= 32,
        "calculated_redirect_uri": calculated_redirect_uri,
        "redirect_uri_match": redirect_uri_match,
        "raw_secret_printed": False,
    }

    all_pass = all([
        checks["KAKAO_CLIENT_ID_present"],
        checks["KAKAO_CLIENT_SECRET_present"],
        checks["NEXTAUTH_URL_correct"],
        checks["NEXTAUTH_SECRET_present"],
        checks["NEXTAUTH_SECRET_min32"],
        checks["redirect_uri_match"],
    ])
    checks["overall"] = "PASS" if all_pass else "FAIL"

    # Safety: verify no raw secrets in output
    assert check_no_raw_secrets(checks), "SECURITY: raw secret detected in output — abort"

    # Save results
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    json_path = RUNS_DIR / f"kakao_env_check_{ts}.json"
    md_path = RUNS_DIR / f"kakao_env_check_{ts}.md"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(checks, f, ensure_ascii=False, indent=2)

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Kakao Auth Env Check — {ts}\n\n")
        f.write(f"**Result: {checks['overall']}**\n\n")
        for k, v in checks.items():
            f.write(f"- {k}: {v}\n")

    if output_json:
        print(json.dumps(checks, ensure_ascii=False, indent=2))
    else:
        print(f"[{checks['overall']}] kakao auth env check")
        print(f"  KAKAO_CLIENT_ID   present={checks['KAKAO_CLIENT_ID_present']} length={checks['KAKAO_CLIENT_ID_length']}")
        print(f"  KAKAO_CLIENT_SECRET present={checks['KAKAO_CLIENT_SECRET_present']} length={checks['KAKAO_CLIENT_SECRET_length']}")
        print(f"  NEXTAUTH_URL      {url} correct={checks['NEXTAUTH_URL_correct']}")
        print(f"  NEXTAUTH_SECRET   present={checks['NEXTAUTH_SECRET_present']} length={checks['NEXTAUTH_SECRET_length']} min32={checks['NEXTAUTH_SECRET_min32']}")
        print(f"  redirect_uri      {calculated_redirect_uri} match={redirect_uri_match}")
        print(f"  saved: {json_path.name}")

    return checks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", dest="output_json")
    args = parser.parse_args()
    result = run(output_json=args.output_json)
    sys.exit(0 if result.get("overall") == "PASS" else 1)


if __name__ == "__main__":
    main()
