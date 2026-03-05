import json
from typing import Optional

import aiosqlite

from .constants import DB_PATH


def _safe_json_loads(value):
    if value in (None, ""):
        return {}
    if isinstance(value, dict):
        return value
    try:
        loaded = json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}
    return loaded if isinstance(loaded, dict) else {}


async def get_audit_logs(
    record_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
) -> list[dict]:
    conditions = []
    params = []
    if record_id is not None:
        conditions.append("record_id = ?")
        params.append(int(record_id))

    query = "SELECT log_id, record_id, action, changed_fields, operator_ip, created_at FROM audit_logs"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    if record_id is not None:
        query += " ORDER BY created_at ASC, log_id ASC"
    else:
        query += " ORDER BY created_at DESC, log_id DESC"
    query += " LIMIT ? OFFSET ?"
    params.extend([page_size, max(0, (page - 1) * page_size)])

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()

    result = []
    for row in rows:
        entry = dict(row)
        entry["changed_fields"] = _safe_json_loads(entry.get("changed_fields"))
        result.append(entry)
    return result


async def count_audit_logs(record_id: Optional[int] = None) -> int:
    conditions = []
    params = []
    if record_id is not None:
        conditions.append("record_id = ?")
        params.append(int(record_id))

    query = "SELECT COUNT(*) FROM audit_logs"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(query, params) as cursor:
            row = await cursor.fetchone()
            return int(row[0] if row else 0)
