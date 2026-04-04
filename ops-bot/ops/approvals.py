"""
승인 관리 — 실행형 명령의 2단계 승인
"""
import time
from dataclasses import dataclass

@dataclass
class PendingApproval:
    job_id: str
    command: str
    args: str
    user_id: int
    chat_id: int
    created_at: float
    expires_at: float  # 60초 후 만료

_pending: dict[str, PendingApproval] = {}
_counter = 0

def create_approval(command: str, args: str, user_id: int, chat_id: int) -> PendingApproval:
    global _counter
    _counter += 1
    job_id = f"J{_counter:04d}"
    now = time.time()
    pa = PendingApproval(
        job_id=job_id,
        command=command,
        args=args,
        user_id=user_id,
        chat_id=chat_id,
        created_at=now,
        expires_at=now + 60,
    )
    _pending[job_id] = pa
    return pa

def confirm_approval(job_id: str, user_id: int) -> tuple[PendingApproval | None, str]:
    pa = _pending.get(job_id)
    if not pa:
        return None, "해당 작업 없음"
    if pa.user_id != user_id:
        return None, "권한 없음"
    if time.time() > pa.expires_at:
        del _pending[job_id]
        return None, "승인 시간 초과 (60초)"
    del _pending[job_id]
    return pa, "승인됨"

def cancel_approval(job_id: str) -> bool:
    return _pending.pop(job_id, None) is not None

def cleanup_expired():
    now = time.time()
    expired = [k for k, v in _pending.items() if now > v.expires_at]
    for k in expired:
        del _pending[k]
