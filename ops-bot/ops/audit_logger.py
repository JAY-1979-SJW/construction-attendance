"""
감사 로그 — 모든 명령 이력 저장
"""
import os
import json
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
AUDIT_FILE = os.path.join(LOG_DIR, "audit.log")

def log_command(
    user_id: int,
    username: str,
    command: str,
    args: str,
    allowed: bool,
    result: str,
    exit_code: int | None = None,
    duration_ms: int | None = None,
):
    entry = {
        "ts": datetime.now(KST).isoformat(),
        "user_id": user_id,
        "username": username,
        "command": command,
        "args": args,
        "allowed": allowed,
        "result": result[:500],  # 최대 500자
        "exit_code": exit_code,
        "duration_ms": duration_ms,
    }
    with open(AUDIT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
