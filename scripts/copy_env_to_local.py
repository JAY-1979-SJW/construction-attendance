"""Copy target keys from .env to .env.local — no secret values in stdout."""
import os
import sys
import tempfile

KEYS = [
    "KAKAO_CLIENT_ID",
    "KAKAO_CLIENT_SECRET",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "AUTH_SECRET",
]

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO_ROOT, ".env")
DST = os.path.join(REPO_ROOT, ".env.local")


def parse_env(path):
    result = {}
    if not os.path.exists(path):
        return result
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip()
    return result


def load_lines(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return f.readlines()


def set_key(lines, key, value):
    prefix = f"{key}="
    updated = False
    result = []
    for line in lines:
        if line.startswith(prefix):
            result.append(f"{key}={value}\n")
            updated = True
        else:
            result.append(line)
    if not updated:
        if result and not result[-1].endswith("\n"):
            result.append("\n")
        result.append(f"{key}={value}\n")
    return result


def atomic_write(path, lines):
    dir_ = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=dir_)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.writelines(lines)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def main():
    src_env = parse_env(SRC)
    dst_lines = load_lines(DST)

    report = {}
    for key in KEYS:
        if key in src_env:
            val = src_env[key]
            dst_lines = set_key(dst_lines, key, val)
            report[key] = {"present": True, "length": len(val)}
        else:
            report[key] = {"present": False}

    atomic_write(DST, dst_lines)

    print("=== .env.local 업데이트 결과 (원문 미포함) ===")
    for key, info in report.items():
        if info["present"]:
            print(f"  {key}: 설정됨 (길이: {info['length']})")
        else:
            print(f"  {key}: .env에 없음 — 수동 등록 필요")


if __name__ == "__main__":
    main()
