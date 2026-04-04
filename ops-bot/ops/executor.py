"""
명령 실행기 — 화이트리스트 스크립트만 subprocess로 실행
shell=True 절대 금지, 인자 직접 전달
"""
import os
import re
import subprocess
import time
from dataclasses import dataclass

SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")

# 민감값 마스킹 패턴
_MASK_PATTERNS = [
    (re.compile(r'(password|secret|token|key)\s*[=:]\s*\S+', re.I), r'\1=***'),
    (re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}'), '***JWT***'),
    (re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'), lambda m: m.group() if m.group().startswith("192.168") or m.group().startswith("10.") else '***IP***'),
]

def mask_sensitive(text: str) -> str:
    for pattern, replacement in _MASK_PATTERNS:
        if callable(replacement):
            text = pattern.sub(replacement, text)
        else:
            text = pattern.sub(replacement, text)
    return text

@dataclass
class ExecResult:
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    script: str

def execute_script(script_name: str, args: str = "", timeout_sec: int = 60) -> ExecResult:
    """화이트리스트 스크립트 실행. shell=True 금지."""
    script_path = os.path.join(SCRIPTS_DIR, os.path.basename(script_name))

    # 경로 탈출 방지
    if ".." in script_name or "/" in script_name.replace("scripts/", ""):
        return ExecResult(
            success=False, exit_code=-1,
            stdout="", stderr="경로 탈출 시도 차단",
            duration_ms=0, script=script_name,
        )

    if not os.path.isfile(script_path):
        return ExecResult(
            success=False, exit_code=-1,
            stdout="", stderr=f"스크립트 없음: {script_path}",
            duration_ms=0, script=script_name,
        )

    # 명령 조립 (shell=False, 인자는 리스트)
    cmd = ["bash", script_path]
    if args:
        # 인자를 공백으로 분리하여 개별 전달 (injection 방지)
        cmd.extend(args.split())

    start = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            # shell=False (기본값, 명시적으로 금지)
        )
        duration = int((time.monotonic() - start) * 1000)
        return ExecResult(
            success=proc.returncode == 0,
            exit_code=proc.returncode,
            stdout=mask_sensitive(proc.stdout[-3000:] if len(proc.stdout) > 3000 else proc.stdout),
            stderr=mask_sensitive(proc.stderr[-1000:] if len(proc.stderr) > 1000 else proc.stderr),
            duration_ms=duration,
            script=script_name,
        )
    except subprocess.TimeoutExpired:
        duration = int((time.monotonic() - start) * 1000)
        return ExecResult(
            success=False, exit_code=-2,
            stdout="", stderr=f"타임아웃 ({timeout_sec}초 초과)",
            duration_ms=duration, script=script_name,
        )
    except Exception as e:
        duration = int((time.monotonic() - start) * 1000)
        return ExecResult(
            success=False, exit_code=-3,
            stdout="", stderr=str(e)[:500],
            duration_ms=duration, script=script_name,
        )
