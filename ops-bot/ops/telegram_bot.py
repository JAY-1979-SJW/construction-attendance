"""
텔레그램 운영봇 — 메인 폴링 루프
명령 수신 → 인증 → 라우팅 → 실행/승인 → 보고
"""
import os
import sys
import time
import json
import urllib.request
import urllib.parse
import urllib.error

from ops.auth import check_access
from ops.router import resolve_command, CmdType, COMMANDS
from ops.approvals import create_approval, confirm_approval, cancel_approval, cleanup_expired
from ops.executor import execute_script
from ops.formatters import (
    format_result, format_approval_request, format_help,
    format_denied, format_unknown,
)
from ops.audit_logger import log_command

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
API = f"https://api.telegram.org/bot{BOT_TOKEN}"
POLL_TIMEOUT = 30  # long polling 초

def _api_call(method: str, data: dict) -> dict:
    """텔레그램 API 호출 (stdlib만 사용, 외부 패키지 없음)"""
    url = f"{API}/{method}"
    encoded = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=encoded, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=POLL_TIMEOUT + 10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[API ERROR] {method}: {e.code} {body[:200]}", file=sys.stderr)
        return {"ok": False}
    except Exception as e:
        print(f"[API ERROR] {method}: {e}", file=sys.stderr)
        return {"ok": False}

def send_message(chat_id: int, text: str, parse_mode: str = "HTML"):
    # 텔레그램 4096자 제한
    if len(text) > 4000:
        text = text[:4000] + "\n... (생략)"
    _api_call("sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
    })

def get_updates(offset: int) -> list[dict]:
    result = _api_call("getUpdates", {
        "offset": offset,
        "timeout": POLL_TIMEOUT,
    })
    return result.get("result", [])

def handle_message(msg: dict):
    """메시지 1건 처리"""
    chat_id = msg.get("chat", {}).get("id", 0)
    user_id = msg.get("from", {}).get("id", 0)
    username = msg.get("from", {}).get("username", "?")
    text = msg.get("text", "").strip()

    if not text:
        return

    # ── 인증 ──
    allowed, reason = check_access(user_id, chat_id)
    if not allowed:
        log_command(user_id, username, text, "", False, reason)
        send_message(chat_id, format_denied(reason))
        return

    # ── /help ──
    if text.lower() in ("/help", "/start", "도움", "help"):
        send_message(chat_id, format_help(COMMANDS))
        log_command(user_id, username, "help", "", True, "OK")
        return

    # ── /confirm ──
    if text.lower().startswith("/confirm"):
        parts = text.split(None, 1)
        job_id = parts[1].strip() if len(parts) > 1 else ""
        pa, msg_text = confirm_approval(job_id, user_id)
        if not pa:
            send_message(chat_id, f"❌ 승인 실패: {msg_text}")
            log_command(user_id, username, "confirm", job_id, True, msg_text)
            return
        # 승인됨 → 실행
        cmd_def = COMMANDS.get(pa.command)
        if not cmd_def:
            send_message(chat_id, "❌ 명령 정의 없음")
            return
        send_message(chat_id, f"⏳ 실행 중: /{pa.command} {pa.args}")
        result = execute_script(cmd_def.script, pa.args, cmd_def.timeout_sec)
        send_message(chat_id, format_result(cmd_def, result, pa.args))
        log_command(user_id, username, pa.command, pa.args, True,
                    "OK" if result.success else "FAIL",
                    result.exit_code, result.duration_ms)
        return

    # ── /cancel ──
    if text.lower().startswith("/cancel"):
        parts = text.split(None, 1)
        job_id = parts[1].strip() if len(parts) > 1 else ""
        if cancel_approval(job_id):
            send_message(chat_id, f"❌ 작업 {job_id} 취소됨")
        else:
            send_message(chat_id, f"❓ 작업 {job_id} 없음")
        log_command(user_id, username, "cancel", job_id, True, "cancelled")
        return

    # ── 명령 라우팅 ──
    cmd_def, cmd_name, args = resolve_command(text)

    if not cmd_def:
        send_message(chat_id, format_unknown(cmd_name))
        log_command(user_id, username, cmd_name, args, True, "unknown")
        return

    # ── 조회형: 즉시 실행 ──
    if cmd_def.cmd_type == CmdType.QUERY:
        send_message(chat_id, f"⏳ 조회 중: /{cmd_name} {args}")
        result = execute_script(cmd_def.script, args, cmd_def.timeout_sec)
        send_message(chat_id, format_result(cmd_def, result, args))
        log_command(user_id, username, cmd_name, args, True,
                    "OK" if result.success else "FAIL",
                    result.exit_code, result.duration_ms)
        return

    # ── 실행형: 승인 요청 ──
    if cmd_def.cmd_type == CmdType.ACTION:
        pa = create_approval(cmd_name, args, user_id, chat_id)
        send_message(chat_id, format_approval_request(pa.job_id, cmd_def, args))
        log_command(user_id, username, cmd_name, args, True, f"pending:{pa.job_id}")
        return

def main():
    if not BOT_TOKEN:
        print("[FATAL] TELEGRAM_BOT_TOKEN 환경변수 필요", file=sys.stderr)
        sys.exit(1)

    # 봇 정보 확인
    me = _api_call("getMe", {})
    if not me.get("ok"):
        print("[FATAL] 봇 토큰 유효하지 않음", file=sys.stderr)
        sys.exit(1)
    bot_name = me["result"].get("username", "?")
    print(f"[OK] @{bot_name} 시작", flush=True)

    offset = 0
    while True:
        try:
            cleanup_expired()
            updates = get_updates(offset)
            for u in updates:
                offset = u["update_id"] + 1
                msg = u.get("message")
                if msg:
                    handle_message(msg)
        except KeyboardInterrupt:
            print("\n[STOP] 종료")
            break
        except Exception as e:
            print(f"[ERROR] {e}", file=sys.stderr)
            time.sleep(5)

if __name__ == "__main__":
    main()
