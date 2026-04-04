"""
명령 라우터 — 화이트리스트 기반 명령 정의 및 분류
"""
from dataclasses import dataclass, field
from enum import Enum

class CmdType(Enum):
    QUERY = "query"        # 조회형: 즉시 실행
    ACTION = "action"      # 실행형: 승인 필요

@dataclass
class CmdDef:
    name: str              # /status, /deploy 등
    cmd_type: CmdType
    script: str            # 실행할 스크립트 경로
    description: str
    args_allowed: bool = False      # 인자 허용 여부
    allowed_args: list[str] = field(default_factory=list)  # 허용 인자 목록 (빈 리스트면 모두 허용)
    timeout_sec: int = 60
    confirm_msg: str = ""  # 승인 확인 메시지

# ═══ 화이트리스트 명령 정의 ═══
COMMANDS: dict[str, CmdDef] = {
    # ── 조회형 (즉시 실행) ──
    "status": CmdDef(
        name="status",
        cmd_type=CmdType.QUERY,
        script="scripts/check_status.sh",
        description="서버 상태 조회 (git, docker, disk)",
        timeout_sec=30,
    ),
    "health": CmdDef(
        name="health",
        cmd_type=CmdType.QUERY,
        script="scripts/check_health.sh",
        description="앱 헬스체크 + 컨테이너 상태",
        timeout_sec=30,
    ),
    "check_jwt": CmdDef(
        name="check_jwt",
        cmd_type=CmdType.QUERY,
        script="scripts/check_jwt_runtime.sh",
        description="JWT 런타임 검증 (sign→verify 테스트)",
        timeout_sec=30,
    ),
    "logs": CmdDef(
        name="logs",
        cmd_type=CmdType.QUERY,
        script="scripts/show_logs_app.sh",
        description="최근 앱 로그 조회",
        args_allowed=True,
        allowed_args=["app", "error", "nginx", "cron"],
        timeout_sec=15,
    ),
    "report": CmdDef(
        name="report",
        cmd_type=CmdType.QUERY,
        script="scripts/check_status.sh",
        description="종합 상태 보고",
        timeout_sec=30,
    ),
    # ── 실행형 (승인 필요) ──
    "deploy": CmdDef(
        name="deploy",
        cmd_type=CmdType.ACTION,
        script="scripts/deploy_safe.sh",
        description="안전 배포 (git pull → docker rebuild)",
        timeout_sec=300,
        confirm_msg="⚠️ 서버 배포를 실행합니다. 컨테이너가 재시작됩니다.",
    ),
    "restart": CmdDef(
        name="restart",
        cmd_type=CmdType.ACTION,
        script="scripts/restart_attendance.sh",
        description="컨테이너 재시작",
        args_allowed=True,
        allowed_args=["attendance"],
        timeout_sec=120,
        confirm_msg="⚠️ 컨테이너를 재시작합니다. 일시적 서비스 중단이 발생합니다.",
    ),
    "backup": CmdDef(
        name="backup",
        cmd_type=CmdType.ACTION,
        script="scripts/backup_db.sh",
        description="DB 백업",
        args_allowed=True,
        allowed_args=["db"],
        timeout_sec=300,
        confirm_msg="⚠️ DB 백업을 실행합니다.",
    ),
}

def resolve_command(text: str) -> tuple[CmdDef | None, str, str]:
    """텍스트 → (CmdDef, 명령명, 인자). 없으면 (None, ?, ?)"""
    text = text.strip()
    if text.startswith("/"):
        text = text[1:]
    parts = text.split(None, 1)
    cmd_name = parts[0].lower() if parts else ""
    args = parts[1].strip() if len(parts) > 1 else ""

    cmd_def = COMMANDS.get(cmd_name)
    if not cmd_def:
        return None, cmd_name, args

    # 인자 검증
    if args and not cmd_def.args_allowed:
        return None, cmd_name, f"인자 허용 안 됨: {args}"
    if args and cmd_def.allowed_args and args not in cmd_def.allowed_args:
        return None, cmd_name, f"허용 인자: {cmd_def.allowed_args}"

    return cmd_def, cmd_name, args
