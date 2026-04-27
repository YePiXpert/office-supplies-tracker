import json
from typing import Optional

from sqlalchemy import text

from .orm import AsyncSessionLocal


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
    params: dict = {}
    if record_id is not None:
        conditions.append("record_id = :record_id")
        params["record_id"] = int(record_id)

    query = "SELECT log_id, record_id, action, changed_fields, operator_ip, created_at FROM audit_logs"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    if record_id is not None:
        query += " ORDER BY created_at ASC, log_id ASC"
    else:
        query += " ORDER BY created_at DESC, log_id DESC"
    query += " LIMIT :limit OFFSET :offset"
    params["limit"] = page_size
    params["offset"] = max(0, (page - 1) * page_size)

    async with AsyncSessionLocal() as session:
        result = await session.execute(text(query), params)
        rows = result.mappings().all()

    records = []
    for row in rows:
        entry = dict(row)
        entry["changed_fields"] = _safe_json_loads(entry.get("changed_fields"))
        records.append(entry)
    return records


async def get_audit_logs_page(
    record_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    conditions = []
    params: dict = {}
    if record_id is not None:
        conditions.append("record_id = :record_id")
        params["record_id"] = int(record_id)

    base_where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    order = (
        " ORDER BY created_at ASC, log_id ASC"
        if record_id is not None
        else " ORDER BY created_at DESC, log_id DESC"
    )
    data_query = (
        "SELECT log_id, record_id, action, changed_fields, operator_ip, created_at"
        " FROM audit_logs"
        + base_where
        + order
        + " LIMIT :limit OFFSET :offset"
    )
    count_query = "SELECT COUNT(*) FROM audit_logs" + base_where

    data_params = {**params, "limit": page_size, "offset": max(0, (page - 1) * page_size)}

    async with AsyncSessionLocal() as session:
        data_result = await session.execute(text(data_query), data_params)
        rows = data_result.mappings().all()

        count_result = await session.execute(text(count_query), params)
        total = int(count_result.scalar_one())

    records = []
    for row in rows:
        entry = dict(row)
        entry["changed_fields"] = _safe_json_loads(entry.get("changed_fields"))
        records.append(entry)
    return records, total


async def count_audit_logs(record_id: Optional[int] = None) -> int:
    conditions = []
    params: dict = {}
    if record_id is not None:
        conditions.append("record_id = :record_id")
        params["record_id"] = int(record_id)

    query = "SELECT COUNT(*) FROM audit_logs"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    async with AsyncSessionLocal() as session:
        result = await session.execute(text(query), params)
        return int(result.scalar_one())
