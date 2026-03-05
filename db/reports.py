from datetime import datetime
from typing import Optional

import aiosqlite

from .constants import DB_PATH
from .filters import build_item_filters


FLOW_STAGES = (
    ("pending_purchase", "待采购"),
    ("pending_arrival", "待到货"),
    ("pending_distribution", "待分发"),
    ("distributed", "已分发"),
)

CYCLE_BUCKETS = (
    ("0-3天", 0, 3),
    ("4-7天", 4, 7),
    ("8-14天", 8, 14),
    ("15-30天", 15, 30),
    ("31天以上", 31, None),
)

PAID_STATUSES = {"已付款", "已报销"}
UNPAID_STATUS = "未付款"


def _parse_iso_date(value) -> Optional[datetime]:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        return None


def _bucketize_days(values: list[int]) -> list[dict]:
    buckets: list[dict] = []
    for label, min_days, max_days in CYCLE_BUCKETS:
        if max_days is None:
            count = sum(1 for day in values if day >= min_days)
        else:
            count = sum(1 for day in values if min_days <= day <= max_days)
        buckets.append(
            {
                "label": label,
                "count": count,
            }
        )
    return buckets


def _average_days(values: list[int]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 2)


def _safe_float(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


async def get_stats_summary() -> dict:
    """获取统计信息（SQL 聚合）。"""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN invoice_issued = 1 THEN 1 ELSE 0 END) AS issued,
                SUM(CASE WHEN invoice_issued = 1 THEN 0 ELSE 1 END) AS not_issued
            FROM items
            WHERE deleted_at IS NULL
            """
        ) as cursor:
            row = await cursor.fetchone()
            total = int(row[0] if row and row[0] is not None else 0)
            issued = int(row[1] if row and row[1] is not None else 0)
            not_issued = int(row[2] if row and row[2] is not None else 0)

        async with db.execute(
            "SELECT status, COUNT(*) FROM items WHERE deleted_at IS NULL GROUP BY status"
        ) as cursor:
            status_rows = await cursor.fetchall()
            status_count = {str(status): int(count) for status, count in status_rows}

        async with db.execute(
            "SELECT payment_status, COUNT(*) FROM items WHERE deleted_at IS NULL GROUP BY payment_status"
        ) as cursor:
            payment_rows = await cursor.fetchall()
            payment_count = {str(status): int(count) for status, count in payment_rows}

    return {
        "total": total,
        "status_count": status_count,
        "payment_count": payment_count,
        "invoice_count": {
            "issued": issued,
            "not_issued": not_issued,
        },
    }


async def get_amount_report(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None
) -> dict:
    """金额统计报表。"""
    conditions, params = build_item_filters(
        status=status, department=department, month=month, keyword=keyword
    )
    where_clause = f" WHERE {' AND '.join(conditions)}" if conditions else ""

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        summary_query = f"""
            SELECT
                COUNT(*) AS total_records,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount,
                COALESCE(SUM(CASE WHEN unit_price IS NOT NULL THEN quantity * unit_price ELSE 0 END), 0) AS priced_amount,
                SUM(CASE WHEN unit_price IS NULL THEN 1 ELSE 0 END) AS missing_price_records
            FROM items
            {where_clause}
        """
        async with db.execute(summary_query, params) as cursor:
            row = await cursor.fetchone()
            summary = dict(row) if row else {}

        department_query = f"""
            SELECT
                department,
                COUNT(*) AS record_count,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount,
                SUM(CASE WHEN unit_price IS NULL THEN 1 ELSE 0 END) AS missing_price_records
            FROM items
            {where_clause}
            GROUP BY department
            ORDER BY total_amount DESC, record_count DESC
            LIMIT 30
        """
        async with db.execute(department_query, params) as cursor:
            by_department = [dict(row) for row in await cursor.fetchall()]

        status_query = f"""
            SELECT
                status,
                COUNT(*) AS record_count,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount
            FROM items
            {where_clause}
            GROUP BY status
            ORDER BY total_amount DESC, record_count DESC
        """
        async with db.execute(status_query, params) as cursor:
            by_status = [dict(row) for row in await cursor.fetchall()]

        month_conditions = list(conditions)
        month_params = list(params)
        month_conditions.append("request_date IS NOT NULL")
        month_conditions.append("request_date <> ''")
        month_where = f" WHERE {' AND '.join(month_conditions)}"

        month_query = f"""
            SELECT
                SUBSTR(request_date, 1, 7) AS month,
                COUNT(*) AS record_count,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount
            FROM items
            {month_where}
            GROUP BY month
            HAVING month IS NOT NULL AND month <> ''
            ORDER BY month DESC
            LIMIT 12
        """
        async with db.execute(month_query, month_params) as cursor:
            by_month = [dict(row) for row in await cursor.fetchall()]

    return {
        "summary": {
            "total_records": int(summary.get("total_records") or 0),
            "total_amount": float(summary.get("total_amount") or 0),
            "priced_amount": float(summary.get("priced_amount") or 0),
            "missing_price_records": int(summary.get("missing_price_records") or 0),
        },
        "by_department": [
            {
                "department": row.get("department") or "",
                "record_count": int(row.get("record_count") or 0),
                "total_amount": float(row.get("total_amount") or 0),
                "missing_price_records": int(row.get("missing_price_records") or 0),
            }
            for row in by_department
        ],
        "by_status": [
            {
                "status": row.get("status") or "",
                "record_count": int(row.get("record_count") or 0),
                "total_amount": float(row.get("total_amount") or 0),
            }
            for row in by_status
        ],
        "by_month": [
            {
                "month": row.get("month") or "",
                "record_count": int(row.get("record_count") or 0),
                "total_amount": float(row.get("total_amount") or 0),
            }
            for row in by_month
        ],
    }


async def get_operations_report(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
) -> dict:
    """执行漏斗、采购周期与月度金额趋势报表。"""
    conditions, params = build_item_filters(
        status=status, department=department, month=month, keyword=keyword
    )
    where_clause = f" WHERE {' AND '.join(conditions)}" if conditions else ""

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        query = f"""
            SELECT
                status,
                payment_status,
                request_date,
                arrival_date,
                distribution_date,
                quantity,
                unit_price
            FROM items
            {where_clause}
        """
        async with db.execute(query, params) as cursor:
            rows = [dict(row) for row in await cursor.fetchall()]

    status_counts = {label: 0 for _, label in FLOW_STAGES}
    req_to_arrival_days: list[int] = []
    arrival_to_dist_days: list[int] = []
    month_summary: dict[str, dict] = {}

    for row in rows:
        status_value = str(row.get("status") or "").strip()
        if status_value in status_counts:
            status_counts[status_value] += 1

        request_dt = _parse_iso_date(row.get("request_date"))
        arrival_dt = _parse_iso_date(row.get("arrival_date"))
        distribution_dt = _parse_iso_date(row.get("distribution_date"))

        if request_dt and arrival_dt:
            request_to_arrival = (arrival_dt - request_dt).days
            if request_to_arrival >= 0:
                req_to_arrival_days.append(request_to_arrival)

        if arrival_dt and distribution_dt:
            arrival_to_distribution = (distribution_dt - arrival_dt).days
            if arrival_to_distribution >= 0:
                arrival_to_dist_days.append(arrival_to_distribution)

        month_key = str(row.get("request_date") or "").strip()[:7]
        if len(month_key) != 7:
            continue
        if month_key[4] != "-":
            continue
        amount = _safe_float(row.get("quantity")) * _safe_float(row.get("unit_price"))
        payment_status = str(row.get("payment_status") or "").strip()
        if month_key not in month_summary:
            month_summary[month_key] = {
                "month": month_key,
                "total_amount": 0.0,
                "paid_amount": 0.0,
                "unpaid_amount": 0.0,
                "record_count": 0,
            }
        month_summary[month_key]["total_amount"] += amount
        month_summary[month_key]["record_count"] += 1
        if payment_status in PAID_STATUSES:
            month_summary[month_key]["paid_amount"] += amount
        elif payment_status == UNPAID_STATUS:
            month_summary[month_key]["unpaid_amount"] += amount

    trend_rows = sorted(month_summary.values(), key=lambda row: row["month"])[-12:]

    return {
        "funnel": [
            {
                "key": key,
                "label": label,
                "count": int(status_counts.get(label, 0)),
            }
            for key, label in FLOW_STAGES
        ],
        "cycle_distribution": {
            "request_to_arrival": {
                "buckets": _bucketize_days(req_to_arrival_days),
                "average_days": _average_days(req_to_arrival_days),
                "sample_size": len(req_to_arrival_days),
            },
            "arrival_to_distribution": {
                "buckets": _bucketize_days(arrival_to_dist_days),
                "average_days": _average_days(arrival_to_dist_days),
                "sample_size": len(arrival_to_dist_days),
            },
        },
        "monthly_amount_trend": [
            {
                "month": row["month"],
                "total_amount": round(float(row["total_amount"]), 2),
                "paid_amount": round(float(row["paid_amount"]), 2),
                "unpaid_amount": round(float(row["unpaid_amount"]), 2),
                "record_count": int(row["record_count"]),
            }
            for row in trend_rows
        ],
    }
