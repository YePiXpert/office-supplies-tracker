import json
from datetime import datetime, timedelta
from typing import Optional

import aiosqlite

from .audit_context import get_current_operator_ip
from .constants import DB_PATH


LOGIN_LOCK_THRESHOLD = 5
LOGIN_LOCK_MINUTES = 15


def _parse_locked_until(value) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        pass
    for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text, pattern)
        except ValueError:
            continue
    return None


def _format_locked_until(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.strftime("%Y-%m-%d %H:%M:%S")


async def get_system_security() -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, password_hash, recovery_code_hash, failed_attempts, locked_until
            FROM system_security
            WHERE id = 1
            LIMIT 1
            """
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def is_system_initialized() -> bool:
    return bool(await get_system_security())


async def initialize_system_security(password_hash: str, recovery_code_hash: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        try:
            async with db.execute("SELECT id FROM system_security WHERE id = 1 LIMIT 1") as cursor:
                exists = await cursor.fetchone()
            if exists:
                raise ValueError("系统已初始化")
            await db.execute(
                """
                INSERT INTO system_security (
                    id, password_hash, recovery_code_hash, failed_attempts, locked_until
                )
                VALUES (1, ?, ?, 0, NULL)
                """,
                (password_hash, recovery_code_hash),
            )
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def update_security_credentials(password_hash: str, recovery_code_hash: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            UPDATE system_security
            SET password_hash = ?, recovery_code_hash = ?, failed_attempts = 0, locked_until = NULL
            WHERE id = 1
            """,
            (password_hash, recovery_code_hash),
        )
        await db.commit()


async def clear_login_lock_state() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE system_security SET failed_attempts = 0, locked_until = NULL WHERE id = 1"
        )
        await db.commit()


async def get_lock_remaining_seconds() -> int:
    row = await get_system_security()
    if not row:
        return 0

    now = datetime.utcnow()
    locked_until = _parse_locked_until(row.get("locked_until"))
    if locked_until is None:
        return 0
    if locked_until <= now:
        await clear_login_lock_state()
        return 0
    return max(1, int((locked_until - now).total_seconds()))


async def register_failed_login_attempt() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN IMMEDIATE")
        try:
            async with db.execute(
                """
                SELECT failed_attempts, locked_until
                FROM system_security
                WHERE id = 1
                LIMIT 1
                """
            ) as cursor:
                row = await cursor.fetchone()
            if not row:
                raise ValueError("系统未初始化")

            now = datetime.utcnow()
            locked_until = _parse_locked_until(row["locked_until"])
            failed_attempts = int(row["failed_attempts"] or 0)

            if locked_until and locked_until > now:
                locked_seconds = max(1, int((locked_until - now).total_seconds()))
                await db.commit()
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
                await db.execute(
                    """
                    UPDATE system_security
                    SET failed_attempts = 0, locked_until = ?
                    WHERE id = 1
                    """,
                    (_format_locked_until(new_locked_until),),
                )
                await db.commit()
                return {
                    "locked_seconds": max(1, int((new_locked_until - now).total_seconds())),
                    "failed_attempts": 0,
                    "attempts_left": 0,
                }

            await db.execute(
                """
                UPDATE system_security
                SET failed_attempts = ?, locked_until = NULL
                WHERE id = 1
                """,
                (failed_attempts,),
            )
            await db.commit()
            attempts_left = max(0, LOGIN_LOCK_THRESHOLD - failed_attempts)
            return {
                "locked_seconds": 0,
                "failed_attempts": failed_attempts,
                "attempts_left": attempts_left,
            }
        except Exception:
            await db.rollback()
            raise


async def append_auth_audit_log(action: str, detail: Optional[dict] = None) -> None:
    payload = detail if isinstance(detail, dict) else {}
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO audit_logs (record_id, action, changed_fields, operator_ip)
            VALUES (?, ?, ?, ?)
            """,
            (
                0,
                str(action or "AUTH").strip().upper(),
                json.dumps(payload, ensure_ascii=False),
                get_current_operator_ip(),
            ),
        )
        await db.commit()
