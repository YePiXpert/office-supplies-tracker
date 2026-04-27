import json
from typing import Optional

from sqlalchemy import select, text

from .constants import ALLOWED_COLUMNS, ITEM_COLUMNS
from .filters import build_history_filters
from .orm import AsyncSessionLocal
from .sqlalchemy_models import ItemHistory


def to_json_text(data: Optional[dict]) -> Optional[str]:
    if data is None:
        return None
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"), default=str)


def safe_json_loads(value: Optional[str]) -> Optional[dict]:
    if not value:
        return None
    try:
        loaded = json.loads(value)
        return loaded if isinstance(loaded, dict) else None
    except json.JSONDecodeError:
        return None


def diff_item_fields(before: dict, after: dict) -> list[str]:
    changed = []
    for column in ALLOWED_COLUMNS:
        if before.get(column) != after.get(column):
            changed.append(column)
    return sorted(changed)


async def get_item_history(
    action: Optional[str] = None,
    keyword: Optional[str] = None,
    month: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> list[dict]:
    conditions, params = build_history_filters(
        action=action, keyword=keyword, month=month
    )
    where_sql = " WHERE " + " AND ".join(conditions) if conditions else ""
    offset = max(0, (page - 1) * page_size)

    query = (
        "SELECT * FROM item_history"
        + where_sql
        + " ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset"
    )

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(query),
            {f"p{i}": v for i, v in enumerate(params)} | {"limit": page_size, "offset": offset},
        )
        rows = result.mappings().all()

    records = []
    for row in rows:
        record = dict(row)
        record["changed_fields"] = (
            record.get("changed_fields", "").split(",")
            if record.get("changed_fields")
            else []
        )
        record["before_data"] = safe_json_loads(record.get("before_data"))
        record["after_data"] = safe_json_loads(record.get("after_data"))
        records.append(record)
    return records


async def get_item_history_page(
    action: Optional[str] = None,
    keyword: Optional[str] = None,
    month: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    conditions, params = build_history_filters(
        action=action, keyword=keyword, month=month
    )
    where_sql = " WHERE " + " AND ".join(conditions) if conditions else ""
    offset = max(0, (page - 1) * page_size)

    data_query = (
        "SELECT * FROM item_history"
        + where_sql
        + " ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset"
    )
    count_query = "SELECT COUNT(*) FROM item_history" + where_sql

    async with AsyncSessionLocal() as session:
        data_result = await session.execute(
            text(data_query),
            {f"p{i}": v for i, v in enumerate(params)} | {"limit": page_size, "offset": offset},
        )
        rows = data_result.mappings().all()

        count_result = await session.execute(
            text(count_query),
            {f"p{i}": v for i, v in enumerate(params)},
        )
        total = int(count_result.scalar_one())

    records = []
    for row in rows:
        record = dict(row)
        record["changed_fields"] = (
            record.get("changed_fields", "").split(",")
            if record.get("changed_fields")
            else []
        )
        record["before_data"] = safe_json_loads(record.get("before_data"))
        record["after_data"] = safe_json_loads(record.get("after_data"))
        records.append(record)
    return records, total


async def count_item_history(
    action: Optional[str] = None,
    keyword: Optional[str] = None,
    month: Optional[str] = None,
) -> int:
    conditions, params = build_history_filters(
        action=action, keyword=keyword, month=month
    )
    query = "SELECT COUNT(*) FROM item_history"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(query),
            {f"p{i}": v for i, v in enumerate(params)},
        )
        return int(result.scalar_one())
