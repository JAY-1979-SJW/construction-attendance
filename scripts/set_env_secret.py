"""Safe .env.local setter — no secret values in stdout/stderr."""
import argparse
import getpass
import os
import sys
import tempfile

ALLOWED_KEYS = {
    "KAKAO_CLIENT_ID",
    "KAKAO_CLIENT_SECRET",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "AUTH_SECRET",
}

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(REPO_ROOT, ".env.local")
GITIGNORE = os.path.join(REPO_ROOT, ".gitignore")


def check_gitignore():
    if not os.path.exists(GITIGNORE):
        return False
    with open(GITIGNORE, encoding="utf-8") as f:
        lines = [l.strip() for l in f]
    return ".env.local" in lines or ".env*.local" in lines


def load_env(path):
    lines = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
    return lines


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
    parser = argparse.ArgumentParser(description="Safe env setter")
    parser.add_argument("--set", required=True, metavar="KEY")
    parser.add_argument("--value", default=None, help="Provide value directly (for non-secret keys)")
    args = parser.parse_args()

    key = args.set
    if key not in ALLOWED_KEYS:
        print(f"ERROR: '{key}' is not in the allowed key list.", file=sys.stderr)
        sys.exit(1)

    if not check_gitignore():
        print("WARNING: .env.local is not listed in .gitignore — please verify before committing.", file=sys.stderr)

    if args.value is not None:
        value = args.value
    else:
        value = getpass.getpass(prompt=f"Enter value for {key} (hidden): ")

    if not value:
        print(f"ERROR: Empty value not allowed for {key}.", file=sys.stderr)
        sys.exit(1)

    lines = load_env(ENV_FILE)
    lines = set_key(lines, key, value)
    atomic_write(ENV_FILE, lines)

    print(f"{key} 설정됨 (길이: {len(value)})")


if __name__ == "__main__":
    main()
