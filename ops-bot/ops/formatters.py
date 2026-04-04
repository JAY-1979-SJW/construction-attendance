"""
텔레그램 메시지 포맷터
"""
from ops.executor import ExecResult
from ops.router import CmdDef, CmdType

def format_result(cmd: CmdDef, result: ExecResult, args: str = "") -> str:
    icon = "✅" if result.success else "❌"
    status = "성공" if result.success else "실패"

    header = f"{icon} <b>/{cmd.name}</b> {args} — {status}"
    body = result.stdout.strip() if result.stdout.strip() else "(출력 없음)"

    # 텔레그램 메시지 제한 (4096자)
    if len(body) > 3000:
        body = body[:3000] + "\n... (생략)"

    msg = f"""{header}
━━━━━━━━━━━━━━
<pre>{_escape_html(body)}</pre>"""

    if result.stderr and not result.success:
        err = result.stderr.strip()[:500]
        msg += f"\n\n⚠️ <pre>{_escape_html(err)}</pre>"

    msg += f"\n\n⏱ {result.duration_ms}ms | exit={result.exit_code}"
    return msg

def format_approval_request(job_id: str, cmd: CmdDef, args: str) -> str:
    return f"""🔐 <b>승인 필요: /{cmd.name}</b> {args}
━━━━━━━━━━━━━━
{cmd.confirm_msg}

📋 {cmd.description}
🔑 작업 ID: <code>{job_id}</code>

✅ 승인: /confirm {job_id}
❌ 취소: /cancel {job_id}

⏰ 60초 내 응답 필요"""

def format_help(commands: dict[str, CmdDef]) -> str:
    lines = ["🤖 <b>운영봇 명령어</b>", "━━━━━━━━━━━━━━", ""]
    lines.append("📊 <b>조회형</b> (즉시 실행)")
    for cmd in commands.values():
        if cmd.cmd_type == CmdType.QUERY:
            args_hint = f" [{'/'.join(cmd.allowed_args)}]" if cmd.allowed_args else ""
            lines.append(f"  /{cmd.name}{args_hint} — {cmd.description}")

    lines.append("")
    lines.append("🔧 <b>실행형</b> (승인 2단계)")
    for cmd in commands.values():
        if cmd.cmd_type == CmdType.ACTION:
            args_hint = f" [{'/'.join(cmd.allowed_args)}]" if cmd.allowed_args else ""
            lines.append(f"  /{cmd.name}{args_hint} — {cmd.description}")

    lines.append("")
    lines.append("🔑 /confirm [ID] — 작업 승인")
    lines.append("❌ /cancel [ID] — 작업 취소")
    return "\n".join(lines)

def format_denied(reason: str) -> str:
    return f"🚫 접근 거부: {reason}"

def format_unknown(cmd_name: str) -> str:
    return f"❓ 모르는 명령: /{cmd_name}\n/help 로 명령어 확인"

def _escape_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
