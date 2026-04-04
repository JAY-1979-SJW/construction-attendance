"""
인증/인가 — user_id, chat_id 화이트리스트 검증
"""
import os

def _parse_ids(env_key: str) -> set[int]:
    raw = os.getenv(env_key, "")
    return {int(x.strip()) for x in raw.split(",") if x.strip().isdigit()}

def is_allowed_user(user_id: int) -> bool:
    return user_id in _parse_ids("ALLOWED_TELEGRAM_USER_IDS")

def is_allowed_chat(chat_id: int) -> bool:
    return chat_id in _parse_ids("ALLOWED_TELEGRAM_CHAT_IDS")

def check_access(user_id: int, chat_id: int) -> tuple[bool, str]:
    if not is_allowed_user(user_id):
        return False, f"미승인 user_id: {user_id}"
    if not is_allowed_chat(chat_id):
        return False, f"미승인 chat_id: {chat_id}"
    return True, "OK"
