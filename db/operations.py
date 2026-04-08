from __future__ import annotations

import re
import sqlite3
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import aiosqlite

from app_runtime import UPLOAD_DIR
from .constants import DB_PATH, ItemStatus

REIMBURSEMENT_STATUS_VALUES = ("pending", "submitted", "reimbursed")
DEFAULT_REIMBURSEMENT_STATUS = "pending"
IMPORT_TASK_STATUS_VALUES = ("pending", "processing", "completed", "failed")
ATTACHMENT_DIR = UPLOAD_DIR / "invoice_attachments"
ATTACHMENT_DIR.mkdir(parents=True, exist_ok=True)


def _normalize_required_text(value: Any, *, field: str, max_length: int) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    if not text:
        raise ValueError(f"{field} cannot be empty")
    if len(text) > max_length:
        raise ValueError(f"{field} is too long")
    return text


def _normalize_optional_text(value: Any, *, max_length: int) -> str | None:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    if not text:
        return None
    if len(text) > max_length:
        raise ValueError("text is too long")
    return text


def _normalize_optional_date(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text).isoformat()
    except ValueError as exc:
        raise ValueError("date must use YYYY-MM-DD") from exc


def _normalize_nonnegative_number(value: Any, *, field: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be a number") from exc
    if number < 0:
        raise ValueError(f"{field} must be >= 0")
    return number


def _normalize_supplier_payload(payload: dict) -> dict:
    return {
        "name": _normalize_required_text(payload.get("name"), field="name", max_length=200),
        "contact_name": _normalize_optional_text(payload.get("contact_name"), max_length=200),
        "contact_phone": _normalize_optional_text(payload.get("contact_phone"), max_length=80),
        "contact_email": _normalize_optional_text(payload.get("contact_email"), max_length=200),
        "notes": _normalize_optional_text(payload.get("notes"), max_length=500),
        "is_active": 1 if bool(payload.get("is_active", True)) else 0,
    }


def _normalize_price_payload(payload: dict) -> dict:
    supplier_id = payload.get("supplier_id")
    if supplier_id in ("", None):
        supplier_id = None
    else:
        supplier_id = int(supplier_id)
        if supplier_id <= 0:
            raise ValueError("supplier_id must be a positive integer")
    return {
        "item_name": _normalize_required_text(payload.get("item_name"), field="item_name", max_length=200),
        "supplier_id": supplier_id,
        "unit_price": _normalize_nonnegative_number(payload.get("unit_price"), field="unit_price"),
        "purchase_link": _normalize_optional_text(payload.get("purchase_link"), max_length=2000),
        "last_purchase_date": _normalize_optional_date(payload.get("last_purchase_date")),
        "last_serial_number": _normalize_optional_text(payload.get("last_serial_number"), max_length=120),
    }


def _normalize_inventory_payload(payload: dict) -> dict:
    supplier_id = payload.get("preferred_supplier_id")
    if supplier_id in ("", None):
        supplier_id = None
    else:
        supplier_id = int(supplier_id)
        if supplier_id <= 0:
            raise ValueError("preferred_supplier_id must be a positive integer")
    return {
        "item_name": _normalize_required_text(payload.get("item_name"), field="item_name", max_length=200),
        "current_stock": _normalize_nonnegative_number(payload.get("current_stock"), field="current_stock"),
        "low_stock_threshold": _normalize_nonnegative_number(payload.get("low_stock_threshold"), field="low_stock_threshold"),
        "unit": _normalize_optional_text(payload.get("unit"), max_length=40),
        "preferred_supplier_id": supplier_id,
        "notes": _normalize_optional_text(payload.get("notes"), max_length=500),
    }


def _normalize_invoice_payload(payload: dict) -> dict:
    status = str(payload.get("reimbursement_status") or DEFAULT_REIMBURSEMENT_STATUS).strip().lower()
    if status not in REIMBURSEMENT_STATUS_VALUES:
        raise ValueError("invalid reimbursement_status")
    return {
        "reimbursement_status": status,
        "reimbursement_date": _normalize_optional_date(payload.get("reimbursement_date")),
        "invoice_number": _normalize_optional_text(payload.get("invoice_number"), max_length=120),
        "note": _normalize_optional_text(payload.get("note"), max_length=500),
    }


def _parse_iso_date(value: Any) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _days_since(value: Any) -> int | None:
    parsed = _parse_iso_date(value)
    if parsed is None:
        return None
    return (date.today() - parsed).days


async def list_suppliers(limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, name, contact_name, contact_phone, contact_email, notes, is_active, created_at, updated_at
            FROM suppliers
            ORDER BY is_active DESC, name COLLATE NOCASE ASC
            LIMIT ?
            """,
            (limit,),
        ) as cursor:
            return [dict(row) for row in await cursor.fetchall()]


async def create_supplier(payload: dict) -> int:
    normalized = _normalize_supplier_payload(payload)
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            INSERT INTO suppliers (name, contact_name, contact_phone, contact_email, notes, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                normalized["name"],
                normalized["contact_name"],
                normalized["contact_phone"],
                normalized["contact_email"],
                normalized["notes"],
                normalized["is_active"],
            ),
        )
        await db.commit()
        return int(cursor.lastrowid)


async def list_price_records(limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT pr.id, pr.item_name, pr.unit_price, pr.purchase_link, pr.last_purchase_date,
                   pr.last_serial_number, pr.created_at, pr.updated_at,
                   s.id AS supplier_id, s.name AS supplier_name
            FROM supplier_price_records pr
            LEFT JOIN suppliers s ON s.id = pr.supplier_id
            ORDER BY pr.updated_at DESC, pr.id DESC
            LIMIT ?
            """,
            (limit,),
        ) as cursor:
            return [dict(row) for row in await cursor.fetchall()]


async def create_price_record(payload: dict) -> int:
    normalized = _normalize_price_payload(payload)
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            INSERT INTO supplier_price_records (
                item_name, supplier_id, unit_price, purchase_link, last_purchase_date, last_serial_number, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                normalized["item_name"],
                normalized["supplier_id"],
                normalized["unit_price"],
                normalized["purchase_link"],
                normalized["last_purchase_date"],
                normalized["last_serial_number"],
            ),
        )
        await db.commit()
        return int(cursor.lastrowid)


async def list_inventory_profiles(limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT ip.id, ip.item_name, ip.current_stock, ip.low_stock_threshold, ip.unit, ip.notes,
                   ip.updated_at, ip.created_at, s.id AS preferred_supplier_id, s.name AS preferred_supplier_name
            FROM inventory_profiles ip
            LEFT JOIN suppliers s ON s.id = ip.preferred_supplier_id
            ORDER BY (ip.current_stock <= ip.low_stock_threshold) DESC, ip.updated_at DESC, ip.id DESC
            LIMIT ?
            """,
            (limit,),
        ) as cursor:
            rows = [dict(row) for row in await cursor.fetchall()]
    for row in rows:
        row["is_low_stock"] = float(row.get("current_stock") or 0) <= float(row.get("low_stock_threshold") or 0)
    return rows


async def upsert_inventory_profile(payload: dict) -> int:
    normalized = _normalize_inventory_payload(payload)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id FROM inventory_profiles WHERE item_name = ? LIMIT 1",
            (normalized["item_name"],),
        ) as cursor:
            existing = await cursor.fetchone()
        if existing:
            profile_id = int(existing["id"])
            await db.execute(
                """
                UPDATE inventory_profiles
                SET current_stock = ?, low_stock_threshold = ?, unit = ?, preferred_supplier_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    normalized["current_stock"],
                    normalized["low_stock_threshold"],
                    normalized["unit"],
                    normalized["preferred_supplier_id"],
                    normalized["notes"],
                    profile_id,
                ),
            )
            await db.commit()
            return profile_id
        cursor = await db.execute(
            """
            INSERT INTO inventory_profiles (
                item_name, current_stock, low_stock_threshold, unit, preferred_supplier_id, notes, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                normalized["item_name"],
                normalized["current_stock"],
                normalized["low_stock_threshold"],
                normalized["unit"],
                normalized["preferred_supplier_id"],
                normalized["notes"],
            ),
        )
        await db.commit()
        return int(cursor.lastrowid)


def create_import_task_run_sync(*, task_id: str, file_name: str, engine: str, protocol: str, status: str = "pending") -> None:
    normalized_status = status if status in IMPORT_TASK_STATUS_VALUES else "pending"
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            """
            INSERT OR REPLACE INTO import_task_runs (
                task_id, file_name, engine, protocol, status, item_count, error_detail, created_at, updated_at, completed_at
            )
            VALUES (
                ?, ?, ?, ?, ?,
                COALESCE((SELECT item_count FROM import_task_runs WHERE task_id = ?), 0),
                COALESCE((SELECT error_detail FROM import_task_runs WHERE task_id = ?), NULL),
                COALESCE((SELECT created_at FROM import_task_runs WHERE task_id = ?), CURRENT_TIMESTAMP),
                CURRENT_TIMESTAMP,
                CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE NULL END
            )
            """,
            (
                task_id,
                Path(file_name or "").name,
                engine,
                protocol,
                normalized_status,
                task_id,
                task_id,
                task_id,
                normalized_status,
            ),
        )
        db.commit()


def update_import_task_run_sync(*, task_id: str, status: str, item_count: int = 0, error_detail: str | None = None) -> None:
    normalized_status = status if status in IMPORT_TASK_STATUS_VALUES else "failed"
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            """
            UPDATE import_task_runs
            SET status = ?,
                item_count = ?,
                error_detail = ?,
                updated_at = CURRENT_TIMESTAMP,
                completed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE task_id = ?
            """,
            (
                normalized_status,
                max(0, int(item_count or 0)),
                error_detail,
                normalized_status,
                task_id,
            ),
        )
        db.commit()


async def list_import_task_runs(limit: int = 30) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT task_id, file_name, engine, protocol, status, item_count, error_detail, created_at, updated_at, completed_at
            FROM import_task_runs
            ORDER BY created_at DESC, task_id DESC
            LIMIT ?
            """,
            (limit,),
        ) as cursor:
            return [dict(row) for row in await cursor.fetchall()]


async def upsert_invoice_record(item_id: int, payload: dict) -> int:
    normalized = _normalize_invoice_payload(payload)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT 1 FROM items WHERE id = ? AND deleted_at IS NULL LIMIT 1",
            (item_id,),
        ) as cursor:
            item_row = await cursor.fetchone()
        if item_row is None:
            raise ValueError("item does not exist")
        async with db.execute("SELECT id FROM invoice_records WHERE item_id = ? LIMIT 1", (item_id,)) as cursor:
            existing = await cursor.fetchone()
        if existing:
            record_id = int(existing["id"])
            await db.execute(
                """
                UPDATE invoice_records
                SET reimbursement_status = ?, reimbursement_date = ?, invoice_number = ?, note = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    normalized["reimbursement_status"],
                    normalized["reimbursement_date"],
                    normalized["invoice_number"],
                    normalized["note"],
                    record_id,
                ),
            )
            await db.commit()
            return record_id
        cursor = await db.execute(
            """
            INSERT INTO invoice_records (
                item_id, reimbursement_status, reimbursement_date, invoice_number, note, updated_at
            )
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                item_id,
                normalized["reimbursement_status"],
                normalized["reimbursement_date"],
                normalized["invoice_number"],
                normalized["note"],
            ),
        )
        await db.commit()
        return int(cursor.lastrowid)


async def create_invoice_attachment(*, item_id: int, file_name: str, stored_name: str, mime_type: str, file_size: int) -> int:
    record_id = await upsert_invoice_record(item_id, {})
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            INSERT INTO invoice_attachments (
                invoice_record_id, file_name, stored_name, mime_type, file_size
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (record_id, file_name, stored_name, mime_type, file_size),
        )
        await db.commit()
        return int(cursor.lastrowid)


async def delete_invoice_attachment(attachment_id: int) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, stored_name FROM invoice_attachments WHERE id = ? LIMIT 1",
            (attachment_id,),
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            return None
        await db.execute("DELETE FROM invoice_attachments WHERE id = ?", (attachment_id,))
        await db.commit()
        return dict(row)


async def get_invoice_attachment(attachment_id: int) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT ia.id, ia.stored_name, ia.file_name, ia.mime_type
            FROM invoice_attachments ia
            JOIN invoice_records ir ON ir.id = ia.invoice_record_id
            JOIN items i ON i.id = ir.item_id
            WHERE ia.id = ? AND i.deleted_at IS NULL
            LIMIT 1
            """,
            (attachment_id,),
        ) as cursor:
            row = await cursor.fetchone()
    return dict(row) if row is not None else None


async def get_operations_center_snapshot() -> dict:
    suppliers = await list_suppliers(limit=20)
    price_records = await list_price_records(limit=20)
    inventory_profiles = await list_inventory_profiles(limit=20)
    import_tasks = await list_import_task_runs(limit=20)
    invoice_queue = await _list_invoice_queue(limit=20)
    notifications = _build_notifications(
        inventory_profiles=inventory_profiles,
        import_tasks=import_tasks,
        invoice_queue=invoice_queue,
    )
    summary = await _get_operations_summary_counts()
    summary["notification_count"] = len(notifications)
    return {
        "summary": summary,
        "suppliers": suppliers,
        "price_records": price_records,
        "inventory_profiles": inventory_profiles,
        "import_tasks": import_tasks,
        "invoice_queue": invoice_queue,
        "notifications": notifications[:20],
    }


async def _get_operations_summary_counts() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        counts = {
            "supplier_count": await _fetch_single_int(db, "SELECT COUNT(1) FROM suppliers"),
            "price_record_count": await _fetch_single_int(db, "SELECT COUNT(1) FROM supplier_price_records"),
            "inventory_profile_count": await _fetch_single_int(db, "SELECT COUNT(1) FROM inventory_profiles"),
            "low_stock_count": await _fetch_single_int(
                db,
                "SELECT COUNT(1) FROM inventory_profiles WHERE current_stock <= low_stock_threshold",
            ),
            "import_task_count": await _fetch_single_int(db, "SELECT COUNT(1) FROM import_task_runs"),
            "failed_import_count": await _fetch_single_int(
                db,
                "SELECT COUNT(1) FROM import_task_runs WHERE status = 'failed'",
            ),
            "pending_reimbursement_count": await _fetch_single_int(
                db,
                """
                SELECT COUNT(1)
                FROM items i
                LEFT JOIN invoice_records ir ON ir.item_id = i.id
                WHERE i.deleted_at IS NULL
                  AND (i.invoice_issued = 1 OR ir.id IS NOT NULL)
                  AND COALESCE(ir.reimbursement_status, 'pending') != 'reimbursed'
                """,
            ),
        }
    return counts


async def _fetch_single_int(db: aiosqlite.Connection, query: str) -> int:
    async with db.execute(query) as cursor:
        row = await cursor.fetchone()
    return int((row[0] if row else 0) or 0)


async def _list_invoice_queue(limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT i.id AS item_id,
                   i.serial_number,
                   i.department,
                   i.handler,
                   i.request_date,
                   i.item_name,
                   i.invoice_issued,
                   i.payment_status,
                   ir.id AS invoice_record_id,
                   COALESCE(ir.reimbursement_status, 'pending') AS reimbursement_status,
                   ir.reimbursement_date,
                   ir.invoice_number,
                   ir.note,
                   COUNT(ia.id) AS attachment_count
            FROM items i
            LEFT JOIN invoice_records ir ON ir.item_id = i.id
            LEFT JOIN invoice_attachments ia ON ia.invoice_record_id = ir.id
            WHERE i.deleted_at IS NULL AND (i.invoice_issued = 1 OR ir.id IS NOT NULL)
            GROUP BY
                i.id, i.serial_number, i.department, i.handler, i.request_date, i.item_name,
                i.invoice_issued, i.payment_status,
                ir.id, ir.reimbursement_status, ir.reimbursement_date, ir.invoice_number, ir.note
            ORDER BY i.request_date DESC, i.id DESC
            LIMIT ?
            """,
            (limit,),
        ) as cursor:
            rows = [dict(row) for row in await cursor.fetchall()]

        invoice_record_ids = [int(row["invoice_record_id"]) for row in rows if row.get("invoice_record_id")]
        attachments_by_record: dict[int, list[dict]] = defaultdict(list)
        if invoice_record_ids:
            placeholders = ", ".join("?" for _ in invoice_record_ids)
            async with db.execute(
                f"""
                SELECT id, invoice_record_id, file_name, stored_name, mime_type, file_size, created_at
                FROM invoice_attachments
                WHERE invoice_record_id IN ({placeholders})
                ORDER BY created_at DESC, id DESC
                """,
                invoice_record_ids,
            ) as cursor:
                for row in await cursor.fetchall():
                    record = dict(row)
                    record["download_url"] = f"/api/ops/invoice-attachments/{record['id']}/download"
                    attachments_by_record[int(record["invoice_record_id"])].append(record)

    for row in rows:
        record_id = row.get("invoice_record_id")
        row["attachments"] = attachments_by_record.get(int(record_id), []) if record_id else []
    return rows


def _build_notifications(*, inventory_profiles: list[dict], import_tasks: list[dict], invoice_queue: list[dict]) -> list[dict]:
    notifications: list[dict] = []
    for profile in inventory_profiles:
        if profile.get("is_low_stock"):
            notifications.append(
                {
                    "category": "inventory",
                    "severity": "warning",
                    "title": "Low stock warning",
                    "detail": (
                        f"{profile.get('item_name') or 'Unknown item'} stock is "
                        f"{profile.get('current_stock')} {profile.get('unit') or ''}, "
                        f"threshold {profile.get('low_stock_threshold')}"
                    ).strip(),
                    "related_item_id": None,
                }
            )
    for task in import_tasks:
        if task.get("status") == "failed":
            notifications.append(
                {
                    "category": "import",
                    "severity": "warning",
                    "title": "Import task failed",
                    "detail": str(task.get("error_detail") or task.get("file_name") or "Unknown import task"),
                    "related_item_id": None,
                }
            )
    for row in invoice_queue:
        if row.get("reimbursement_status") != "reimbursed":
            notifications.append(
                {
                    "category": "invoice",
                    "severity": "notice",
                    "title": "Reimbursement pending",
                    "detail": f"{row.get('item_name') or 'Unknown item'} reimbursement is still {row.get('reimbursement_status')}",
                    "related_item_id": int(row.get("item_id") or 0) or None,
                }
            )
    notifications.extend(_build_overdue_notifications())
    severity_order = {"critical": 0, "warning": 1, "notice": 2}
    notifications.sort(key=lambda row: (severity_order.get(row["severity"], 9), row["category"], row["title"]))
    return notifications


def _build_overdue_notifications() -> list[dict]:
    notifications: list[dict] = []
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        rows = db.execute(
            "SELECT id, item_name, request_date, arrival_date, status FROM items WHERE deleted_at IS NULL"
        ).fetchall()
    for row in rows:
        item_id = int(row["id"])
        item_name = str(row["item_name"] or "Unknown item")
        status = str(row["status"] or "")
        request_days = _days_since(row["request_date"])
        arrival_days = _days_since(row["arrival_date"])
        if status == ItemStatus.PENDING.value and request_days is not None and request_days > 7:
            notifications.append(
                {
                    "category": "overdue",
                    "severity": "critical",
                    "title": "Purchase overdue",
                    "detail": f"{item_name} has stayed in pending purchase for {request_days} days",
                    "related_item_id": item_id,
                }
            )
        elif status == ItemStatus.PENDING_ARRIVAL.value and request_days is not None and request_days > 14:
            notifications.append(
                {
                    "category": "overdue",
                    "severity": "critical",
                    "title": "Arrival overdue",
                    "detail": f"{item_name} has waited {request_days} days since request date",
                    "related_item_id": item_id,
                }
            )
        elif status == ItemStatus.PENDING_DISTRIBUTION.value and arrival_days is not None and arrival_days > 3:
            notifications.append(
                {
                    "category": "overdue",
                    "severity": "critical",
                    "title": "Distribution overdue",
                    "detail": f"{item_name} has waited {arrival_days} days since arrival",
                    "related_item_id": item_id,
                }
            )
    return notifications
