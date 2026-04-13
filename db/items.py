import re
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

import aiosqlite
from sqlalchemy import select, text, tuple_

from .constants import (
    ALLOWED_COLUMNS,
    DB_PATH,
    EXECUTION_BOARD_COLUMNS,
    ITEM_COLUMNS,
    ItemStatus,
    PaymentStatus,
)
from .filters import build_item_filters
from .history import diff_item_fields, safe_json_loads, to_json_text
from .orm import AsyncSessionLocal
from .sqlalchemy_models import Item, ItemHistory


TEXT_FIELD_MAX_LENGTH = {
    "serial_number": 120,
    "department": 120,
    "handler": 80,
    "request_date": 32,
    "arrival_date": 32,
    "distribution_date": 32,
    "item_name": 200,
    "purchase_link": 2000,
    "signoff_note": 500,
}

DATE_CANONICAL_PATTERN = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$")
DATE_COMPACT_PATTERN = re.compile(r"^(\d{4})(\d{2})(\d{2})$")
DEFAULT_STATUS = "待采购"
DEFAULT_PAYMENT_STATUS = "未付款"
DEFAULT_INVOICE_ISSUED = 0
ITEM_STATUS_VALUES = {status.value for status in ItemStatus}
PAYMENT_STATUS_VALUES = {status.value for status in PaymentStatus}
FULLWIDTH_TRANSLATION = str.maketrans(
    {
        "０": "0",
        "１": "1",
        "２": "2",
        "３": "3",
        "４": "4",
        "５": "5",
        "６": "6",
        "７": "7",
        "８": "8",
        "９": "9",
        "：": ":",
        "／": "/",
        "．": ".",
        "－": "-",
        "　": " ",
    }
)


def _normalize_required_text(field: str, value) -> str:
    text = str(value or "").translate(FULLWIDTH_TRANSLATION).strip()
    text = re.sub(r"\s+", " ", text)
    if not text:
        raise ValueError(f"{field} 不能为空")
    limit = TEXT_FIELD_MAX_LENGTH.get(field)
    if limit is not None and len(text) > limit:
        raise ValueError(f"{field} 长度不能超过 {limit}")
    return text


def _normalize_optional_text(field: str, value) -> Optional[str]:
    if value is None:
        return None
    text = str(value).translate(FULLWIDTH_TRANSLATION).strip()
    text = re.sub(r"\s+", " ", text)
    if not text:
        return None
    limit = TEXT_FIELD_MAX_LENGTH.get(field)
    if limit is not None and len(text) > limit:
        raise ValueError(f"{field} 长度不能超过 {limit}")
    return text


def _normalize_quantity(value) -> float:
    try:
        quantity = float(value)
    except (TypeError, ValueError):
        raise ValueError("quantity 必须为数字")
    if quantity <= 0:
        raise ValueError("quantity 必须 > 0")
    return quantity


def _normalize_unit_price(value) -> Optional[float]:
    if value is None:
        return None
    try:
        unit_price = float(value)
    except (TypeError, ValueError):
        raise ValueError("unit_price 必须为数字")
    if unit_price < 0:
        raise ValueError("unit_price 不能为负数")
    return unit_price


def _normalize_optional_supplier_id(value) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        supplier_id = int(value)
    except (TypeError, ValueError):
        raise ValueError("supplier_id 必须为正整数")
    if supplier_id <= 0:
        raise ValueError("supplier_id 必须为正整数")
    return supplier_id


def _normalize_status(value) -> str:
    if isinstance(value, ItemStatus):
        return value.value
    text = _normalize_required_text("status", value)
    if text not in ITEM_STATUS_VALUES:
        allowed = " / ".join(sorted(ITEM_STATUS_VALUES))
        raise ValueError(f"status 仅支持: {allowed}")
    return text


def _normalize_payment_status(value) -> str:
    if isinstance(value, PaymentStatus):
        return value.value
    text = _normalize_required_text("payment_status", value)
    if text not in PAYMENT_STATUS_VALUES:
        allowed = " / ".join(sorted(PAYMENT_STATUS_VALUES))
        raise ValueError(f"payment_status 仅支持: {allowed}")
    return text


def _normalize_invoice_issued(value) -> int:
    if value is None:
        return DEFAULT_INVOICE_ISSUED
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, int):
        if value in (0, 1):
            return value
    if isinstance(value, float):
        if value.is_integer():
            int_value = int(value)
            if int_value in (0, 1):
                return int_value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "y"}:
            return 1
        if lowered in {"0", "false", "no", "n"}:
            return 0
    raise ValueError("invoice_issued 仅支持 true/false 或 0/1")


def _normalize_request_date(value) -> str:
    """容错解析日期并统一为 YYYY-MM-DD。"""
    raw = _normalize_required_text("request_date", value)
    normalized = (
        raw.replace("年", "-")
        .replace("月", "-")
        .replace("日", "")
        .replace("号", "")
        .replace("/", "-")
        .replace(".", "-")
        .replace("T", " ")
        .strip()
    )
    if " " in normalized:
        normalized = normalized.split(" ", 1)[0].strip()
    normalized = re.sub(r"-+", "-", normalized).strip("-")

    matched = DATE_CANONICAL_PATTERN.fullmatch(normalized)
    if matched:
        year, month, day = matched.groups()
    else:
        compact = DATE_COMPACT_PATTERN.fullmatch(normalized)
        if compact:
            year, month, day = compact.groups()
        else:
            raise ValueError(
                "request_date 格式应为 YYYY-MM-DD（支持 YYYY/M/D、YYYY年M月D日）"
            )

    try:
        parsed = datetime(int(year), int(month), int(day))
    except ValueError:
        raise ValueError("request_date 不是有效日期")
    return parsed.strftime("%Y-%m-%d")


def _normalize_optional_date(field: str, value) -> Optional[str]:
    text = _normalize_optional_text(field, value)
    if text is None:
        return None
    return _normalize_request_date(text)


def _normalize_serial_number(value) -> str:
    return _normalize_required_text("serial_number", value).upper().replace(" ", "")


def _normalize_purchase_link(value) -> Optional[str]:
    text = _normalize_optional_text("purchase_link", value)
    if not text:
        return None
    compact = text.replace(" ", "")
    compact = re.sub(r"[，。；;、）)\]>》]+$", "", compact)
    if compact.lower().startswith("www."):
        compact = f"https://{compact}"
    parsed = urlparse(compact)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("purchase_link 必须是有效的 http(s) URL")
    if len(compact) > TEXT_FIELD_MAX_LENGTH["purchase_link"]:
        raise ValueError(
            f"purchase_link 长度不能超过 {TEXT_FIELD_MAX_LENGTH['purchase_link']}"
        )
    return compact


def normalize_item_payload(item: dict) -> dict:
    """标准化并校验新增记录。"""
    payload = dict(item)
    payload["serial_number"] = _normalize_serial_number(payload.get("serial_number"))
    payload["department"] = _normalize_required_text(
        "department", payload.get("department")
    )
    payload["handler"] = _normalize_required_text("handler", payload.get("handler"))
    payload["request_date"] = _normalize_request_date(payload.get("request_date"))
    payload["item_name"] = _normalize_required_text(
        "item_name", payload.get("item_name")
    )
    payload["purchase_link"] = _normalize_purchase_link(payload.get("purchase_link"))
    payload["quantity"] = _normalize_quantity(payload.get("quantity"))
    payload["unit_price"] = _normalize_unit_price(payload.get("unit_price"))
    payload["supplier_id"] = _normalize_optional_supplier_id(payload.get("supplier_id"))
    payload["status"] = _normalize_status(payload.get("status", DEFAULT_STATUS))
    payload["payment_status"] = _normalize_payment_status(
        payload.get("payment_status", DEFAULT_PAYMENT_STATUS)
    )
    payload["invoice_issued"] = _normalize_invoice_issued(
        payload.get("invoice_issued", DEFAULT_INVOICE_ISSUED)
    )
    payload["arrival_date"] = _normalize_optional_date(
        "arrival_date", payload.get("arrival_date")
    )
    payload["distribution_date"] = _normalize_optional_date(
        "distribution_date",
        payload.get("distribution_date"),
    )
    payload["signoff_note"] = _normalize_optional_text(
        "signoff_note", payload.get("signoff_note")
    )
    return payload


def normalize_update_payload(updates: dict) -> dict:
    """标准化并校验更新记录。"""
    payload = dict(updates)
    if "serial_number" in payload:
        payload["serial_number"] = _normalize_serial_number(
            payload.get("serial_number")
        )
    if "department" in payload:
        payload["department"] = _normalize_required_text(
            "department", payload.get("department")
        )
    if "handler" in payload:
        payload["handler"] = _normalize_required_text("handler", payload.get("handler"))
    if "request_date" in payload:
        payload["request_date"] = _normalize_request_date(payload.get("request_date"))
    if "item_name" in payload:
        payload["item_name"] = _normalize_required_text(
            "item_name", payload.get("item_name")
        )
    if "purchase_link" in payload:
        payload["purchase_link"] = _normalize_purchase_link(
            payload.get("purchase_link")
        )
    if "quantity" in payload:
        payload["quantity"] = _normalize_quantity(payload.get("quantity"))
    if "unit_price" in payload:
        payload["unit_price"] = _normalize_unit_price(payload.get("unit_price"))
    if "supplier_id" in payload:
        payload["supplier_id"] = _normalize_optional_supplier_id(
            payload.get("supplier_id")
        )
    if "status" in payload:
        payload["status"] = _normalize_status(payload.get("status"))
    if "payment_status" in payload:
        payload["payment_status"] = _normalize_payment_status(
            payload.get("payment_status")
        )
    if "invoice_issued" in payload:
        payload["invoice_issued"] = _normalize_invoice_issued(
            payload.get("invoice_issued")
        )
    if "arrival_date" in payload:
        payload["arrival_date"] = _normalize_optional_date(
            "arrival_date", payload.get("arrival_date")
        )
    if "distribution_date" in payload:
        payload["distribution_date"] = _normalize_optional_date(
            "distribution_date",
            payload.get("distribution_date"),
        )
    if "signoff_note" in payload:
        payload["signoff_note"] = _normalize_optional_text(
            "signoff_note", payload.get("signoff_note")
        )
    return payload


def _validate_allowed_columns(payload: dict) -> None:
    invalid = set(payload.keys()) - ALLOWED_COLUMNS
    if invalid:
        raise ValueError(f"不允许的字段: {invalid}")


def _deduplicate_positive_ids(raw_ids: list[int]) -> list[int]:
    unique_ids = []
    seen = set()
    for raw in raw_ids:
        item_id = int(raw)
        if item_id <= 0:
            raise ValueError("ids 必须为正整数")
        if item_id not in seen:
            seen.add(item_id)
            unique_ids.append(item_id)
    return unique_ids


def _has_effective_changes(before_data: dict, updates: dict) -> bool:
    for field, new_value in updates.items():
        if before_data.get(field) != new_value:
            return True
    return False


def _item_snapshot(item: Item) -> dict:
    return {column: getattr(item, column, None) for column in ITEM_COLUMNS}


async def _resolve_supplier_snapshot(
    session, supplier_id: Optional[int]
) -> tuple[Optional[int], Optional[str]]:
    if supplier_id is None:
        return None, None

    result = await session.execute(
        text(
            """
            SELECT id, name
            FROM suppliers
            WHERE id = :supplier_id
            LIMIT 1
            """
        ),
        {"supplier_id": int(supplier_id)},
    )
    row = result.mappings().first()
    if not row:
        raise ValueError("supplier_id 对应的供应商不存在")
    return int(row["id"]), str(row["name"] or "").strip() or None


async def _apply_supplier_snapshot(session, payload: dict) -> dict:
    normalized = dict(payload)
    if "supplier_id" not in normalized:
        return normalized

    supplier_id, supplier_name = await _resolve_supplier_snapshot(
        session, normalized.get("supplier_id")
    )
    normalized["supplier_id"] = supplier_id
    normalized["supplier_name_snapshot"] = supplier_name
    return normalized


def _parse_optional_timestamp(value) -> Optional[datetime]:
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


def _append_item_history_record(
    session,
    *,
    item_id: Optional[int],
    action: str,
    before_data: Optional[dict],
    after_data: Optional[dict],
    changed_fields: Optional[list[str]] = None,
) -> None:
    source = after_data or before_data or {}
    changed_text = ",".join(changed_fields or []) or None
    session.add(
        ItemHistory(
            item_id=item_id,
            action=action,
            serial_number=source.get("serial_number"),
            department=source.get("department"),
            handler=source.get("handler"),
            item_name=source.get("item_name"),
            changed_fields=changed_text,
            before_data=to_json_text(before_data),
            after_data=to_json_text(after_data),
        )
    )


def _item_unique_key(source) -> tuple[str, str, str]:
    if isinstance(source, dict):
        serial_number = source.get("serial_number")
        item_name = source.get("item_name")
        handler = source.get("handler")
    else:
        serial_number = getattr(source, "serial_number", None)
        item_name = getattr(source, "item_name", None)
        handler = getattr(source, "handler", None)
    return (
        str(serial_number or "").strip(),
        str(item_name or "").strip(),
        str(handler or "").strip(),
    )


async def _load_items_by_unique_keys(
    session, keys: list[tuple[str, str, str]]
) -> dict[tuple[str, str, str], Item]:
    unique_keys = list(dict.fromkeys(keys))
    if not unique_keys:
        return {}

    stmt = select(Item).where(
        tuple_(Item.serial_number, Item.item_name, Item.handler).in_(unique_keys)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return {_item_unique_key(item): item for item in rows}


async def get_items(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
) -> list[dict]:
    """获取所有物品列表。"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        query = "SELECT * FROM items"
        conditions, params = build_item_filters(
            status=status, department=department, month=month, keyword=keyword
        )

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY created_at DESC, id DESC"

        if page is not None and page_size is not None:
            offset = max(0, (page - 1) * page_size)
            query += " LIMIT ? OFFSET ?"
            params.extend([page_size, offset])

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def stream_items(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
):
    """以异步生成器方式逐行产出物品记录，避免全量加载至内存。"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        query = "SELECT * FROM items"
        conditions, params = build_item_filters(
            status=status, department=department, month=month, keyword=keyword
        )
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY created_at DESC, id DESC"
        async with db.execute(query, params) as cursor:
            async for row in cursor:
                yield dict(row)


async def get_execution_board(
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
    limit_per_status: int = 80,
) -> dict:
    """获取采购执行看板（按状态分栏）。"""
    columns = []
    total = 0
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # 一次 GROUP BY 查询取代 3 次独立 COUNT(*)
        count_conditions, count_params = build_item_filters(
            department=department, month=month, keyword=keyword
        )
        status_values = [status for _, status in EXECUTION_BOARD_COLUMNS]
        placeholders = ", ".join("?" for _ in status_values)
        base_conditions = list(count_conditions) + [f"status IN ({placeholders})"]
        count_query = (
            "SELECT status, COUNT(*) FROM items"
            " WHERE " + " AND ".join(base_conditions) + " GROUP BY status"
        )
        async with db.execute(count_query, [*count_params, *status_values]) as cursor:
            counts_by_status = {row[0]: int(row[1]) for row in await cursor.fetchall()}

        for key, status in EXECUTION_BOARD_COLUMNS:
            conditions, params = build_item_filters(
                status=status,
                department=department,
                month=month,
                keyword=keyword,
            )

            list_query = (
                "SELECT id, serial_number, department, handler, request_date,"
                " item_name, quantity, unit_price, supplier_id, supplier_name_snapshot,"
                " status, payment_status, invoice_issued, arrival_date,"
                " distribution_date, signoff_note, created_at, updated_at"
                " FROM items"
            )
            if conditions:
                list_query += " WHERE " + " AND ".join(conditions)
            list_query += " ORDER BY created_at DESC, id DESC LIMIT ?"
            async with db.execute(list_query, [*params, limit_per_status]) as cursor:
                items = [dict(record) for record in await cursor.fetchall()]

            count = counts_by_status.get(status, 0)
            columns.append(
                {
                    "key": key,
                    "status": status,
                    "label": status,
                    "count": count,
                    "items": items,
                }
            )
            total += count

    return {
        "columns": columns,
        "total": total,
        "limit_per_status": limit_per_status,
    }


async def count_items(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
) -> int:
    """获取筛选后的记录总数。"""
    async with aiosqlite.connect(DB_PATH) as db:
        query = "SELECT COUNT(*) FROM items"
        conditions, params = build_item_filters(
            status=status, department=department, month=month, keyword=keyword
        )
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        async with db.execute(query, params) as cursor:
            row = await cursor.fetchone()
            return int(row[0] if row else 0)


async def get_items_page(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    """在同一个 DB 连接内完成 COUNT + SELECT，返回 (items, total) 元组。"""
    conditions, params = build_item_filters(
        status=status, department=department, month=month, keyword=keyword
    )
    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

    count_query = f"SELECT COUNT(*) FROM items{where_clause}"
    offset = max(0, (page - 1) * page_size)
    list_query = (
        f"SELECT * FROM items{where_clause}"
        " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?"
    )

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(count_query, params) as cursor:
            row = await cursor.fetchone()
            total = int(row[0] if row else 0)

        async with db.execute(list_query, [*params, page_size, offset]) as cursor:
            items = [dict(row) for row in await cursor.fetchall()]

    return items, total


async def get_item(item_id: int) -> Optional[dict]:
    """获取单个物品详情。"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM items WHERE id = ? AND deleted_at IS NULL",
            (item_id,),
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def create_item(item: dict) -> int:
    """创建新物品记录。"""
    payload = normalize_item_payload(item)
    async with AsyncSessionLocal() as session:
        payload = await _apply_supplier_snapshot(session, payload)
        existing_stmt = (
            select(Item)
            .where(
                Item.serial_number == payload["serial_number"],
                Item.item_name == payload["item_name"],
                Item.handler == payload["handler"],
            )
            .limit(1)
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing and existing.deleted_at is not None:
            before_data = _item_snapshot(existing)
            for key, value in payload.items():
                setattr(existing, key, value)
            existing.deleted_at = None
            existing.updated_at = datetime.utcnow()
            await session.flush()
            after_data = _item_snapshot(existing)
            changed_fields = diff_item_fields(before_data, after_data)
            if before_data.get("deleted_at") != after_data.get("deleted_at"):
                changed_fields = sorted(set(changed_fields + ["deleted_at"]))
            _append_item_history_record(
                session,
                item_id=existing.id,
                action="update",
                before_data=before_data,
                after_data=after_data,
                changed_fields=changed_fields or ["deleted_at"],
            )
            await session.commit()
            return int(existing.id)

        created = Item(**payload)
        session.add(created)
        await session.flush()
        snapshot = _item_snapshot(created)
        _append_item_history_record(
            session,
            item_id=created.id,
            action="create",
            before_data=None,
            after_data=snapshot,
            changed_fields=sorted(ALLOWED_COLUMNS),
        )
        await session.commit()
        return int(created.id)


async def update_item(item_id: int, updates: dict) -> bool:
    """更新物品记录。"""
    if not updates:
        return False
    payload = normalize_update_payload(updates)
    _validate_allowed_columns(payload)
    async with AsyncSessionLocal() as session:
        payload = await _apply_supplier_snapshot(session, payload)
        item = (
            await session.execute(select(Item).where(Item.id == item_id).limit(1))
        ).scalar_one_or_none()
        if not item or item.deleted_at is not None:
            return False

        before_data = _item_snapshot(item)
        for field, value in payload.items():
            setattr(item, field, value)
        item.updated_at = datetime.utcnow()
        await session.flush()

        after_data = _item_snapshot(item)
        changed_fields = diff_item_fields(before_data, after_data)
        if changed_fields:
            _append_item_history_record(
                session,
                item_id=item_id,
                action="update",
                before_data=before_data,
                after_data=after_data,
                changed_fields=changed_fields,
            )
        await session.commit()
        return True


async def delete_item(item_id: int) -> bool:
    """删除物品记录。"""
    async with AsyncSessionLocal() as session:
        item = (
            await session.execute(select(Item).where(Item.id == item_id).limit(1))
        ).scalar_one_or_none()
        if not item or item.deleted_at is not None:
            return False

        before_data = _item_snapshot(item)
        item.deleted_at = datetime.utcnow()
        item.updated_at = datetime.utcnow()
        await session.flush()

        after_data = _item_snapshot(item)
        changed_fields = sorted(ALLOWED_COLUMNS)
        if before_data.get("deleted_at") != after_data.get("deleted_at"):
            changed_fields = sorted(set(changed_fields + ["deleted_at"]))
        _append_item_history_record(
            session,
            item_id=item_id,
            action="delete",
            before_data=before_data,
            after_data=after_data,
            changed_fields=changed_fields,
        )
        await session.commit()
        return True


async def batch_create_items(items: list[dict]) -> list[int]:
    """批量创建物品记录。"""
    normalized_items = [normalize_item_payload(raw_item) for raw_item in items]
    created_ids = []
    async with AsyncSessionLocal() as session:
        normalized_items = [
            await _apply_supplier_snapshot(session, payload)
            for payload in normalized_items
        ]
        existing_by_key = await _load_items_by_unique_keys(
            session,
            [_item_unique_key(payload) for payload in normalized_items],
        )
        active_keys = {
            key for key, item in existing_by_key.items() if item.deleted_at is None
        }

        for payload in normalized_items:
            key = _item_unique_key(payload)
            existing = existing_by_key.get(key)
            if key in active_keys:
                continue
            if existing and existing.deleted_at is not None:
                before_data = _item_snapshot(existing)
                for field_name, field_value in payload.items():
                    setattr(existing, field_name, field_value)
                existing.deleted_at = None
                existing.updated_at = datetime.utcnow()
                await session.flush()
                after_data = _item_snapshot(existing)
                changed_fields = diff_item_fields(before_data, after_data)
                if before_data.get("deleted_at") != after_data.get("deleted_at"):
                    changed_fields = sorted(set(changed_fields + ["deleted_at"]))
                _append_item_history_record(
                    session,
                    item_id=existing.id,
                    action="update",
                    before_data=before_data,
                    after_data=after_data,
                    changed_fields=changed_fields or ["deleted_at"],
                )
                created_ids.append(int(existing.id))
                active_keys.add(key)
                continue

            created = Item(**payload)
            session.add(created)
            await session.flush()
            snapshot = _item_snapshot(created)
            _append_item_history_record(
                session,
                item_id=created.id,
                action="create",
                before_data=None,
                after_data=snapshot,
                changed_fields=sorted(ALLOWED_COLUMNS),
            )
            created_ids.append(int(created.id))
            existing_by_key[key] = created
            active_keys.add(key)
        await session.commit()
    return created_ids


async def get_existing_items_by_keys(
    keys: list[tuple[str, str, str]],
) -> dict[tuple[str, str, str], dict]:
    """按 (serial_number, item_name, handler) 批量查询已存在记录。"""
    unique_keys = list(dict.fromkeys(keys))
    if not unique_keys:
        return {}

    results: dict[tuple[str, str, str], dict] = {}
    chunk_size = 200
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        for start in range(0, len(unique_keys), chunk_size):
            chunk = unique_keys[start : start + chunk_size]
            placeholders = ", ".join(["(?, ?, ?)"] * len(chunk))
            params = []
            for serial_number, item_name, handler in chunk:
                params.extend([serial_number, item_name, handler])
            query = (
                "SELECT * FROM items "
                f"WHERE (serial_number, item_name, handler) IN ({placeholders}) "
                "AND deleted_at IS NULL"
            )
            async with db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                for row in rows:
                    record = dict(row)
                    key = (
                        str(record.get("serial_number") or "").strip(),
                        str(record.get("item_name") or "").strip(),
                        str(record.get("handler") or "").strip(),
                    )
                    results[key] = record

    return results


async def bulk_update_quantities(quantity_updates: dict[int, float]) -> int:
    """批量更新数量，单次连接提交，减少导入合并开销。"""
    if not quantity_updates:
        return 0

    normalized_updates: dict[int, float] = {}
    for item_id, quantity in quantity_updates.items():
        normalized_updates[int(item_id)] = _normalize_quantity(quantity)

    updated_count = 0
    async with AsyncSessionLocal() as session:
        for item_id, quantity in normalized_updates.items():
            item = (
                await session.execute(select(Item).where(Item.id == item_id).limit(1))
            ).scalar_one_or_none()
            if not item or item.deleted_at is not None:
                continue
            before_data = _item_snapshot(item)
            if before_data.get("quantity") == quantity:
                continue
            item.quantity = quantity
            item.updated_at = datetime.utcnow()
            await session.flush()
            after_data = _item_snapshot(item)
            changed_fields = diff_item_fields(before_data, after_data)
            if changed_fields:
                _append_item_history_record(
                    session,
                    item_id=item_id,
                    action="update",
                    before_data=before_data,
                    after_data=after_data,
                    changed_fields=changed_fields,
                )
            updated_count += 1
        await session.commit()

    return updated_count


async def batch_update_items(item_ids: list[int], updates: dict) -> dict:
    """批量更新记录，单连接事务提交并写入历史。"""
    if not item_ids:
        return {
            "updated_count": 0,
            "missing_ids": [],
            "unchanged_count": 0,
        }
    payload = normalize_update_payload(updates)
    if not payload:
        raise ValueError("未提供可更新字段")
    _validate_allowed_columns(payload)
    unique_ids = _deduplicate_positive_ids(item_ids)

    async with AsyncSessionLocal() as session:
        payload = await _apply_supplier_snapshot(session, payload)
        rows = (
            (
                await session.execute(
                    select(Item).where(
                        Item.id.in_(unique_ids),
                        Item.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        existing_by_id = {int(row.id): row for row in rows}

        missing_ids = [
            item_id for item_id in unique_ids if item_id not in existing_by_id
        ]
        updated_count = 0
        unchanged_count = 0

        for item_id in unique_ids:
            item = existing_by_id.get(item_id)
            if not item:
                continue
            before_data = _item_snapshot(item)
            if not _has_effective_changes(before_data, payload):
                unchanged_count += 1
                continue
            for field, value in payload.items():
                setattr(item, field, value)
            item.updated_at = datetime.utcnow()
            await session.flush()
            after_data = _item_snapshot(item)
            changed_fields = diff_item_fields(before_data, after_data)
            if changed_fields:
                _append_item_history_record(
                    session,
                    item_id=item_id,
                    action="update",
                    before_data=before_data,
                    after_data=after_data,
                    changed_fields=changed_fields,
                )
            updated_count += 1

        await session.commit()

    return {
        "updated_count": updated_count,
        "missing_ids": missing_ids,
        "unchanged_count": unchanged_count,
    }


async def list_deleted_items(
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> list[dict]:
    conditions, params = build_item_filters(keyword=keyword, only_deleted=True)
    query = "SELECT * FROM items"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY deleted_at DESC, id DESC LIMIT ? OFFSET ?"
    params.extend([page_size, max(0, (page - 1) * page_size)])

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def count_deleted_items(keyword: Optional[str] = None) -> int:
    conditions, params = build_item_filters(keyword=keyword, only_deleted=True)
    query = "SELECT COUNT(*) FROM items"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(query, params) as cursor:
            row = await cursor.fetchone()
            return int(row[0] if row else 0)


async def restore_item(item_id: int) -> bool:
    async with AsyncSessionLocal() as session:
        item = (
            await session.execute(select(Item).where(Item.id == item_id).limit(1))
        ).scalar_one_or_none()
        if not item or item.deleted_at is None:
            return False
        before_data = _item_snapshot(item)
        item.deleted_at = None
        item.updated_at = datetime.utcnow()
        await session.flush()
        after_data = _item_snapshot(item)
        changed_fields = diff_item_fields(before_data, after_data)
        if before_data.get("deleted_at") != after_data.get("deleted_at"):
            changed_fields = sorted(set(changed_fields + ["deleted_at"]))
        _append_item_history_record(
            session,
            item_id=item_id,
            action="update",
            before_data=before_data,
            after_data=after_data,
            changed_fields=changed_fields or ["deleted_at"],
        )
        await session.commit()
        return True


async def purge_item(item_id: int) -> bool:
    async with AsyncSessionLocal() as session:
        item = (
            await session.execute(select(Item).where(Item.id == item_id).limit(1))
        ).scalar_one_or_none()
        if not item or item.deleted_at is None:
            return False
        await session.delete(item)
        await session.commit()
        return True


async def rollback_item_to_history(item_id: int, history_id: int) -> bool:
    async with AsyncSessionLocal() as session:
        item = (
            await session.execute(select(Item).where(Item.id == item_id).limit(1))
        ).scalar_one_or_none()
        if not item:
            return False

        history = (
            await session.execute(
                select(ItemHistory)
                .where(
                    ItemHistory.id == history_id,
                    ItemHistory.item_id == item_id,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if not history:
            raise ValueError("指定历史记录不存在")

        snapshot = safe_json_loads(history.before_data)
        if not snapshot:
            raise ValueError("该历史记录缺少可回滚快照")

        restored_payload = {
            column: snapshot.get(column)
            for column in ALLOWED_COLUMNS
            if column in snapshot
        }
        normalized = normalize_update_payload(restored_payload)
        if not normalized:
            raise ValueError("回滚快照不包含可恢复字段")

        before_data = _item_snapshot(item)
        for field, value in normalized.items():
            setattr(item, field, value)
        item.deleted_at = _parse_optional_timestamp(snapshot.get("deleted_at"))
        item.updated_at = datetime.utcnow()
        await session.flush()
        after_data = _item_snapshot(item)
        changed_fields = diff_item_fields(before_data, after_data or {})
        if before_data.get("deleted_at") != (after_data or {}).get("deleted_at"):
            changed_fields = sorted(set(changed_fields + ["deleted_at"]))
        _append_item_history_record(
            session,
            item_id=item_id,
            action="update",
            before_data=before_data,
            after_data=after_data,
            changed_fields=changed_fields or ["deleted_at"],
        )
        await session.commit()
        return True


async def get_data_quality_report(limit: int = 200) -> dict:
    max_rows = max(1, min(int(limit), 1000))
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute(
            """
            SELECT id, serial_number, department, handler, request_date, item_name,
                   quantity, purchase_link, unit_price, supplier_id, supplier_name_snapshot, status
            FROM items
            WHERE deleted_at IS NULL
            ORDER BY updated_at DESC, id DESC
            LIMIT ?
            """,
            (max_rows,),
        ) as cursor:
            rows = [dict(row) for row in await cursor.fetchall()]

        async with db.execute(
            """
            SELECT serial_number, item_name, handler, COUNT(*) AS duplicate_count
            FROM items
            WHERE deleted_at IS NULL
            GROUP BY serial_number, item_name, handler
            HAVING COUNT(*) > 1
            ORDER BY duplicate_count DESC
            LIMIT 50
            """
        ) as cursor:
            duplicates = [dict(row) for row in await cursor.fetchall()]

    issues: list[dict] = []
    for row in rows:
        row_issues: list[str] = []
        if not str(row.get("department") or "").strip():
            row_issues.append("missing_department")
        if not str(row.get("handler") or "").strip():
            row_issues.append("missing_handler")
        if not str(row.get("request_date") or "").strip():
            row_issues.append("missing_request_date")
        quantity_value = row.get("quantity")
        try:
            quantity_number = float(quantity_value if quantity_value is not None else 0)
        except (TypeError, ValueError):
            quantity_number = 0
        if quantity_number <= 0:
            row_issues.append("invalid_quantity")
        link = str(row.get("purchase_link") or "").strip()
        if not link:
            row_issues.append("missing_purchase_link")
        elif not re.match(r"^https?://", link, re.IGNORECASE):
            row_issues.append("invalid_purchase_link")
        request_date = str(row.get("request_date") or "").strip()
        if request_date and not DATE_CANONICAL_PATTERN.fullmatch(request_date):
            row_issues.append("invalid_request_date_format")
        if row_issues:
            issues.append(
                {
                    "id": int(row.get("id") or 0),
                    "serial_number": row.get("serial_number") or "",
                    "item_name": row.get("item_name") or "",
                    "issues": row_issues,
                }
            )

    summary: dict[str, int] = {}
    for issue in issues:
        for code in issue["issues"]:
            summary[code] = summary.get(code, 0) + 1
    if duplicates:
        summary["duplicate_active_keys"] = len(duplicates)

    return {
        "summary": summary,
        "issues": issues,
        "duplicates": duplicates,
        "scanned_rows": len(rows),
    }


async def get_serial_numbers() -> list[str]:
    """获取所有流水号（用于自动补全）。"""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT DISTINCT serial_number FROM items WHERE deleted_at IS NULL ORDER BY serial_number DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [row[0] for row in rows]


async def get_departments() -> list[str]:
    """获取所有部门（用于自动补全）。

    策略（Option B）：返回 items 表中所有历史部门名称，包含已软删除记录。
    部门名称完全由导入时解析器自动写入，不使用硬编码列表。
    选择历史包含策略的理由：台账筛选器需要能回溯已删除单据的部门，
    确保用户不会因为部门下的所有单据被删除后该部门从筛选项消失而丢失上下文。
    """
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT DISTINCT department FROM items ORDER BY department"
        ) as cursor:
            rows = await cursor.fetchall()
    return [row[0] for row in rows if row[0]]


async def get_handlers() -> list[str]:
    """获取所有经办人（用于自动补全）。"""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT DISTINCT handler FROM items WHERE deleted_at IS NULL ORDER BY handler"
        ) as cursor:
            rows = await cursor.fetchall()
            return [row[0] for row in rows]
