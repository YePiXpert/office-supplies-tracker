import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, text

from .audit_context import get_current_operator_ip
from .orm import AsyncSessionLocal
from .sqlalchemy_models import SystemSecurity


LOGIN_LOCK_THRESHOLD = 5
LOGIN_LOCK_MINUTES = 15


def _parse_locked_until(value) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    text_val = str(value).strip()
    if not text_val:
        return None
    try:
        dt = datetime.fromisoformat(text_val)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        pass
    for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text_val, pattern).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _format_locked_until(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.strftime("%Y-%m-%d %H:%M:%S")


async def get_system_security() -> Optional[dict]:
    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(SystemSecurity).where(SystemSecurity.id == 1).limit(1)
            )
        ).scalar_one_or_none()
        if not row:
            return None
        return {
            "id": row.id,
            "password_hash": row.password_hash,
            "recovery_code_hash": row.recovery_code_hash,
            "failed_attempts": row.failed_attempts,
            "locked_until": row.locked_until,
        }


async def is_system_initialized() -> bool:
    return bool(await get_system_security())


async def initialize_system_security(
    password_hash: str, recovery_code_hash: str
) -> None:
    async with AsyncSessionLocal() as session:
        existing = (
            await session.execute(
                select(SystemSecurity.id).where(SystemSecurity.id == 1).limit(1)
            )
        ).scalar_one_or_none()
        if existing:
            raise ValueError("系统已初始化")
        session.add(
            SystemSecurity(
                id=1,
                password_hash=password_hash,
                recovery_code_hash=recovery_code_hash,
                failed_attempts=0,
                locked_until=None,
            )
        )
        await session.commit()


async def update_security_credentials(
    password_hash: str, recovery_code_hash: str
) -> None:
    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(SystemSecurity).where(SystemSecurity.id == 1).limit(1)
            )
        ).scalar_one_or_none()
        if not row:
            raise ValueError("系统未初始化")
        row.password_hash = password_hash
        row.recovery_code_hash = recovery_code_hash
        row.failed_attempts = 0
        row.locked_until = None
        await session.commit()


async def clear_login_lock_state() -> None:
    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(SystemSecurity).where(SystemSecurity.id == 1).limit(1)
            )
        ).scalar_one_or_none()
        if row:
            row.failed_attempts = 0
            row.locked_until = None
            await session.commit()


async def get_lock_remaining_seconds() -> int:
    row = await get_system_security()
    if not row:
        return 0

    now = datetime.now(timezone.utc)
    locked_until = _parse_locked_until(row.get("locked_until"))
    if locked_until is None:
        return 0
    if locked_until <= now:
        await clear_login_lock_state()
        return 0
    return max(1, int((locked_until - now).total_seconds()))


async def register_failed_login_attempt() -> dict:
    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(SystemSecurity).where(SystemSecurity.id == 1).limit(1)
            )
        ).scalar_one_or_none()
        if not row:
            raise ValueError("系统未初始化")

        now = datetime.now(timezone.utc)
        locked_until = _parse_locked_until(row.locked_until)
        failed_attempts = int(row.failed_attempts or 0)

        if locked_until and locked_until > now:
            locked_seconds = max(1, int((locked_until - now).total_seconds()))
            return {
                "locked_seconds": locked_seconds,
                "failed_attempts": failed_attempts,
                "attempts_left": 0,
            }

        if locked_until and locked_until <= now:
            failed_attempts = 0

        failed_attempts += 1

        if failed_attempts >= LOGIN_LOCK_THRESHOLD:
            new_locked_until = now + timedelta(minutes=LOGIN_LOCK_MINUTES)
            row.failed_attempts = 0
            row.locked_until = new_locked_until
            await session.commit()
            return {
                "locked_seconds": max(
                    1, int((new_locked_until - now).total_seconds())
                ),
                "failed_attempts": 0,
                "attempts_left": 0,
            }

        row.failed_attempts = failed_attempts
        row.locked_until = None
        await session.commit()
        attempts_left = max(0, LOGIN_LOCK_THRESHOLD - failed_attempts)
        return {
            "locked_seconds": 0,
            "failed_attempts": failed_attempts,
            "attempts_left": attempts_left,
        }


async def append_auth_audit_log(action: str, detail: Optional[dict] = None) -> None:
    payload = detail if isinstance(detail, dict) else {}
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                """
                INSERT INTO audit_logs (record_id, action, changed_fields, operator_ip)
                VALUES (:record_id, :action, :changed_fields, :operator_ip)
                """
            ),
            {
                "record_id": 0,
                "action": str(action or "AUTH").strip().upper(),
                "changed_fields": json.dumps(payload, ensure_ascii=False),
                "operator_ip": get_current_operator_ip(),
            },
        )
        await session.commit()
