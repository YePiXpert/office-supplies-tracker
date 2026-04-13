from datetime import date, datetime
from typing import Optional

import aiosqlite

from .constants import DB_PATH
from .filters import build_item_filters
from .operations import get_procurement_tracker_report


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


def _safe_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _normalize_year_value(year: Optional[str], month: Optional[str]) -> str:
    text = str(year or "").strip()
    if len(text) == 4 and text.isdigit():
        return text
    month_text = str(month or "").strip()
    if len(month_text) >= 4 and month_text[:4].isdigit():
        return month_text[:4]
    return str(date.today().year)


def _month_to_quarter(month_str: str) -> str:
    """Convert '2024-03' -> '2024-Q1'. Returns '' on invalid input."""
    text = (month_str or "").strip()
    if len(text) < 7 or text[4] != "-":
        return ""
    year = text[:4]
    month_num = _safe_int(text[5:7])
    if month_num < 1 or month_num > 12:
        return ""
    quarter = (month_num - 1) // 3 + 1
    return f"{year}-Q{quarter}"


def _fill_month_zeros(data: list[dict], count: int = 12) -> list[dict]:
    """Return the most-recent `count` months, zero-filling any gaps.
    Each element in `data` must have a 'period' key (YYYY-MM).
    """
    today = date.today()
    months = []
    for i in range(count - 1, -1, -1):
        yr = today.year - (today.month - 1 - i < 0 and 1 or 0)
        mn = (today.month - 1 - i) % 12 + 1
        # simpler: walk back month by month
        yr2 = today.year
        mn2 = today.month - i
        while mn2 <= 0:
            mn2 += 12
            yr2 -= 1
        months.append(f"{yr2:04d}-{mn2:02d}")

    lookup = {row["period"]: row for row in data}
    return [
        lookup.get(m) or {"period": m, "record_count": 0, "total_amount": 0.0}
        for m in months
    ]


def _fill_quarter_zeros(data: list[dict], count: int = 8) -> list[dict]:
    """Return the most-recent `count` natural quarters, zero-filling gaps.
    Each element in `data` must have a 'period' key (YYYY-Qn).
    """
    today = date.today()
    current_q = (today.month - 1) // 3 + 1
    current_year = today.year
    quarters = []
    q = current_q
    y = current_year
    for _ in range(count):
        quarters.append(f"{y:04d}-Q{q}")
        q -= 1
        if q == 0:
            q = 4
            y -= 1
    quarters.reverse()

    lookup = {row["period"]: row for row in data}
    return [
        lookup.get(q) or {"period": q, "record_count": 0, "total_amount": 0.0}
        for q in quarters
    ]


def _fill_year_zeros(data: list[dict], count: int = 5) -> list[dict]:
    """Return the most-recent `count` years, zero-filling gaps."""
    current_year = date.today().year
    years = [str(current_year - i) for i in range(count - 1, -1, -1)]
    lookup = {row["period"]: row for row in data}
    return [
        lookup.get(y) or {"period": y, "record_count": 0, "total_amount": 0.0}
        for y in years
    ]


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
    keyword: Optional[str] = None,
    granularity: str = "month",
) -> dict:
    """金额统计报表，支持 granularity=month|quarter|year。"""
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

        # Period trend — always pull raw month rows then aggregate/fill in Python
        period_conditions = list(conditions)
        period_params = list(params)
        period_conditions.append("request_date IS NOT NULL")
        period_conditions.append("request_date <> ''")
        period_where = f" WHERE {' AND '.join(period_conditions)}"

        month_query = f"""
            SELECT
                SUBSTR(request_date, 1, 7) AS period,
                COUNT(*) AS record_count,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount
            FROM items
            {period_where}
            GROUP BY period
            HAVING period IS NOT NULL AND period <> ''
            ORDER BY period ASC
        """
        async with db.execute(month_query, period_params) as cursor:
            raw_month_rows = [dict(row) for row in await cursor.fetchall()]

    # Build normalised period rows
    norm_month = [
        {
            "period": r["period"],
            "record_count": _safe_int(r["record_count"]),
            "total_amount": _safe_float(r["total_amount"]),
        }
        for r in raw_month_rows
    ]

    if granularity == "year":
        year_map: dict[str, dict] = {}
        for r in norm_month:
            yr = r["period"][:4]
            e = year_map.setdefault(yr, {"period": yr, "record_count": 0, "total_amount": 0.0})
            e["record_count"] += r["record_count"]
            e["total_amount"] += r["total_amount"]
        by_period = _fill_year_zeros(list(year_map.values()), count=5)
    elif granularity == "quarter":
        q_map: dict[str, dict] = {}
        for r in norm_month:
            qk = _month_to_quarter(r["period"])
            if not qk:
                continue
            e = q_map.setdefault(qk, {"period": qk, "record_count": 0, "total_amount": 0.0})
            e["record_count"] += r["record_count"]
            e["total_amount"] += r["total_amount"]
        by_period = _fill_quarter_zeros(list(q_map.values()), count=8)
    else:
        by_period = _fill_month_zeros(norm_month, count=12)

    return {
        "granularity": granularity,
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
        "by_period": [
            {
                "period": row.get("period") or "",
                "record_count": int(row.get("record_count") or 0),
                "total_amount": round(float(row.get("total_amount") or 0), 2),
            }
            for row in by_period
        ],
        # Keep by_month for backward compat (last 12 filled months)
        "by_month": [
            {
                "month": row.get("period") or "",
                "record_count": int(row.get("record_count") or 0),
                "total_amount": round(float(row.get("total_amount") or 0), 2),
            }
            for row in _fill_month_zeros(norm_month, count=12)
        ],
    }


async def get_operations_report(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
) -> dict:
    """状态快照、采购周期与月度金额趋势报表。"""
    conditions, params = build_item_filters(
        status=status, department=department, month=month, keyword=keyword
    )
    where_clause = f" WHERE {' AND '.join(conditions)}" if conditions else ""

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Status snapshot (count + amount per status, overdue counts)
        today_str = date.today().isoformat()
        snapshot_query = f"""
            SELECT
                status,
                COUNT(*) AS record_count,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount,
                SUM(CASE
                    WHEN status IN ('待采购','待到货','待分发')
                         AND request_date IS NOT NULL
                         AND request_date <> ''
                         AND request_date < date('{today_str}', '-14 days')
                    THEN 1 ELSE 0 END) AS overdue_count
            FROM items
            {where_clause}
            GROUP BY status
        """
        async with db.execute(snapshot_query, params) as cursor:
            snapshot_rows = [dict(row) for row in await cursor.fetchall()]

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

    req_to_arrival_days: list[int] = []
    arrival_to_dist_days: list[int] = []
    month_summary: dict[str, dict] = {}

    for row in rows:
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

    trend_rows = sorted(month_summary.values(), key=lambda r: r["month"])[-12:]

    # Build cycle buckets with sample-size denominator (not max-count)
    req_sample = len(req_to_arrival_days)
    dist_sample = len(arrival_to_dist_days)

    def _buckets_with_ratio(values: list[int], sample_size: int) -> list[dict]:
        raw = _bucketize_days(values)
        for bucket in raw:
            bucket["ratio"] = round(
                (bucket["count"] / sample_size * 100) if sample_size > 0 else 0.0, 2
            )
        return raw

    return {
        # Renamed from 'funnel' to 'status_snapshot' — these are current-state counts
        "status_snapshot": [
            {
                "status": row.get("status") or "",
                "record_count": _safe_int(row.get("record_count")),
                "total_amount": round(_safe_float(row.get("total_amount")), 2),
                "overdue_count": _safe_int(row.get("overdue_count")),
            }
            for row in snapshot_rows
        ],
        # Keep 'funnel' alias so existing frontend code doesn't break immediately
        "funnel": [
            {
                "key": key,
                "label": label,
                "count": next(
                    (
                        _safe_int(r.get("record_count"))
                        for r in snapshot_rows
                        if r.get("status") == label
                    ),
                    0,
                ),
            }
            for key, label in FLOW_STAGES
        ],
        "cycle_distribution": {
            "request_to_arrival": {
                "buckets": _buckets_with_ratio(req_to_arrival_days, req_sample),
                "average_days": _average_days(req_to_arrival_days),
                "sample_size": req_sample,
            },
            "arrival_to_distribution": {
                "buckets": _buckets_with_ratio(arrival_to_dist_days, dist_sample),
                "average_days": _average_days(arrival_to_dist_days),
                "sample_size": dist_sample,
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


async def get_supplier_report(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
    year: Optional[str] = None,
    supplier_id: Optional[int] = None,
    granularity: str = "month",
) -> dict:
    """供应商采购分析报表，支持 granularity=month|quarter|year。"""
    selected_year = _normalize_year_value(year, month)
    summary_conditions, summary_params = build_item_filters(
        status=status, department=department, month=month, keyword=keyword
    )
    if supplier_id:
        summary_conditions.append("supplier_id = ?")
        summary_params.append(int(supplier_id))
    summary_where = f" WHERE {' AND '.join(summary_conditions)}" if summary_conditions else ""

    trend_conditions, trend_params = build_item_filters(
        status=status, department=department, month=None, keyword=keyword
    )
    trend_conditions.append("request_date IS NOT NULL")
    trend_conditions.append("request_date <> ''")
    trend_conditions.append("SUBSTR(request_date, 1, 4) = ?")
    trend_params.append(selected_year)
    if supplier_id:
        trend_conditions.append("supplier_id = ?")
        trend_params.append(int(supplier_id))
    trend_where = f" WHERE {' AND '.join(trend_conditions)}" if trend_conditions else ""

    yearly_conditions, yearly_params = build_item_filters(
        status=status, department=department, month=None, keyword=keyword
    )
    yearly_conditions.append("request_date IS NOT NULL")
    yearly_conditions.append("request_date <> ''")
    if supplier_id:
        yearly_conditions.append("supplier_id = ?")
        yearly_params.append(int(supplier_id))
    yearly_where = f" WHERE {' AND '.join(yearly_conditions)}" if yearly_conditions else ""

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        summary_query = f"""
            SELECT
                COUNT(*) AS total_records,
                COUNT(DISTINCT CASE WHEN supplier_id IS NOT NULL THEN supplier_id END) AS supplier_count,
                SUM(CASE WHEN supplier_id IS NOT NULL THEN 1 ELSE 0 END) AS assigned_records,
                SUM(CASE WHEN supplier_id IS NULL THEN 1 ELSE 0 END) AS unassigned_records,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount,
                COALESCE(SUM(CASE WHEN supplier_id IS NOT NULL THEN quantity * COALESCE(unit_price, 0) ELSE 0 END), 0) AS assigned_amount,
                COALESCE(SUM(CASE WHEN supplier_id IS NULL THEN quantity * COALESCE(unit_price, 0) ELSE 0 END), 0) AS unassigned_amount
            FROM items
            {summary_where}
        """
        async with db.execute(summary_query, summary_params) as cursor:
            summary_row = dict(await cursor.fetchone() or {})

        top_suppliers_query = f"""
            SELECT
                supplier_id,
                COALESCE(supplier_name_snapshot, '未归属供应商') AS supplier_name,
                COUNT(*) AS record_count,
                COUNT(DISTINCT item_name) AS item_count,
                COALESCE(SUM(quantity), 0) AS total_quantity,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount,
                MAX(request_date) AS latest_request_date
            FROM items
            {summary_where}
            GROUP BY supplier_id, supplier_name
            ORDER BY total_amount DESC, record_count DESC, supplier_name COLLATE NOCASE ASC
            LIMIT 12
        """
        async with db.execute(top_suppliers_query, summary_params) as cursor:
            top_supplier_rows = [dict(row) for row in await cursor.fetchall()]

        # Monthly trend for selected year (used for month/quarter granularity)
        monthly_trend_query = f"""
            SELECT
                SUBSTR(request_date, 1, 7) AS month,
                supplier_id,
                COALESCE(supplier_name_snapshot, '未归属供应商') AS supplier_name,
                COUNT(*) AS record_count,
                COALESCE(SUM(quantity), 0) AS total_quantity,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount
            FROM items
            {trend_where}
            GROUP BY month, supplier_id, supplier_name
            HAVING month IS NOT NULL AND month <> ''
            ORDER BY month ASC, total_amount DESC, supplier_name COLLATE NOCASE ASC
        """
        async with db.execute(monthly_trend_query, trend_params) as cursor:
            monthly_trend_rows = [dict(row) for row in await cursor.fetchall()]

        # Yearly summary — direct GROUP BY year, no LIMIT truncation
        yearly_summary_query = f"""
            SELECT
                SUBSTR(request_date, 1, 4) AS year,
                supplier_id,
                COALESCE(supplier_name_snapshot, '未归属供应商') AS supplier_name,
                COUNT(*) AS record_count,
                COUNT(DISTINCT item_name) AS item_count,
                COALESCE(SUM(quantity), 0) AS total_quantity,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount
            FROM items
            {yearly_where}
            GROUP BY year, supplier_id, supplier_name
            HAVING year IS NOT NULL AND year <> ''
            ORDER BY year DESC, total_amount DESC, supplier_name COLLATE NOCASE ASC
        """
        async with db.execute(yearly_summary_query, yearly_params) as cursor:
            yearly_summary_rows = [dict(row) for row in await cursor.fetchall()]

        supplier_item_query = f"""
            SELECT
                supplier_id,
                COALESCE(supplier_name_snapshot, '未归属供应商') AS supplier_name,
                item_name,
                COUNT(*) AS record_count,
                COALESCE(SUM(quantity), 0) AS total_quantity,
                COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0) AS total_amount,
                MAX(request_date) AS latest_request_date
            FROM items
            {summary_where}
            GROUP BY supplier_id, supplier_name, item_name
            ORDER BY total_amount DESC, record_count DESC, item_name COLLATE NOCASE ASC
            LIMIT 80
        """
        async with db.execute(supplier_item_query, summary_params) as cursor:
            supplier_item_rows = [dict(row) for row in await cursor.fetchall()]

        unassigned_query = f"""
            SELECT
                id, serial_number, request_date, department, handler, item_name,
                quantity, unit_price, status
            FROM items
            {summary_where}
            {"AND" if summary_where else "WHERE"} supplier_id IS NULL
            ORDER BY request_date DESC, id DESC
            LIMIT 50
        """
        async with db.execute(unassigned_query, summary_params) as cursor:
            unassigned_rows = [dict(row) for row in await cursor.fetchall()]

    # Build quarterly trend from monthly rows
    quarterly_trend_map: dict[tuple, dict] = {}
    for r in monthly_trend_rows:
        qk = _month_to_quarter(r["month"])
        if not qk:
            continue
        sid = _safe_int(r.get("supplier_id")) or None
        sname = r.get("supplier_name") or "未归属供应商"
        key = (qk, sid, sname)
        e = quarterly_trend_map.setdefault(
            key,
            {
                "quarter": qk,
                "supplier_id": sid,
                "supplier_name": sname,
                "record_count": 0,
                "total_quantity": 0.0,
                "total_amount": 0.0,
            },
        )
        e["record_count"] += _safe_int(r.get("record_count"))
        e["total_quantity"] += _safe_float(r.get("total_quantity"))
        e["total_amount"] += _safe_float(r.get("total_amount"))

    quarterly_trend_rows = sorted(
        quarterly_trend_map.values(), key=lambda r: (r["quarter"], -(r["total_amount"]))
    )

    return {
        "selected_year": selected_year,
        "granularity": granularity,
        "selected_supplier_id": int(supplier_id) if supplier_id else None,
        "summary": {
            "total_records": _safe_int(summary_row.get("total_records")),
            "supplier_count": _safe_int(summary_row.get("supplier_count")),
            "assigned_records": _safe_int(summary_row.get("assigned_records")),
            "unassigned_records": _safe_int(summary_row.get("unassigned_records")),
            "total_amount": _safe_float(summary_row.get("total_amount")),
            "assigned_amount": _safe_float(summary_row.get("assigned_amount")),
            "unassigned_amount": _safe_float(summary_row.get("unassigned_amount")),
        },
        "top_suppliers": [
            {
                "supplier_id": _safe_int(row.get("supplier_id")) or None,
                "supplier_name": row.get("supplier_name") or "未归属供应商",
                "record_count": _safe_int(row.get("record_count")),
                "item_count": _safe_int(row.get("item_count")),
                "total_quantity": _safe_float(row.get("total_quantity")),
                "total_amount": _safe_float(row.get("total_amount")),
                "latest_request_date": row.get("latest_request_date") or "",
            }
            for row in top_supplier_rows
        ],
        "monthly_trend": [
            {
                "month": row.get("month") or "",
                "supplier_id": _safe_int(row.get("supplier_id")) or None,
                "supplier_name": row.get("supplier_name") or "未归属供应商",
                "record_count": _safe_int(row.get("record_count")),
                "total_quantity": _safe_float(row.get("total_quantity")),
                "total_amount": _safe_float(row.get("total_amount")),
            }
            for row in monthly_trend_rows
        ],
        "quarterly_trend": [
            {
                "quarter": row.get("quarter") or "",
                "supplier_id": row.get("supplier_id"),
                "supplier_name": row.get("supplier_name") or "未归属供应商",
                "record_count": _safe_int(row.get("record_count")),
                "total_quantity": round(_safe_float(row.get("total_quantity")), 2),
                "total_amount": round(_safe_float(row.get("total_amount")), 2),
            }
            for row in quarterly_trend_rows
        ],
        "yearly_summary": [
            {
                "year": row.get("year") or "",
                "supplier_id": _safe_int(row.get("supplier_id")) or None,
                "supplier_name": row.get("supplier_name") or "未归属供应商",
                "record_count": _safe_int(row.get("record_count")),
                "item_count": _safe_int(row.get("item_count")),
                "total_quantity": _safe_float(row.get("total_quantity")),
                "total_amount": _safe_float(row.get("total_amount")),
            }
            for row in yearly_summary_rows
        ],
        "supplier_items": [
            {
                "supplier_id": _safe_int(row.get("supplier_id")) or None,
                "supplier_name": row.get("supplier_name") or "未归属供应商",
                "item_name": row.get("item_name") or "",
                "record_count": _safe_int(row.get("record_count")),
                "total_quantity": _safe_float(row.get("total_quantity")),
                "total_amount": _safe_float(row.get("total_amount")),
                "latest_request_date": row.get("latest_request_date") or "",
            }
            for row in supplier_item_rows
        ],
        "unassigned_items": [
            {
                "id": _safe_int(row.get("id")),
                "serial_number": row.get("serial_number") or "",
                "request_date": row.get("request_date") or "",
                "department": row.get("department") or "",
                "handler": row.get("handler") or "",
                "item_name": row.get("item_name") or "",
                "quantity": _safe_float(row.get("quantity")),
                "unit_price": _safe_float(row.get("unit_price")),
                "status": row.get("status") or "",
            }
            for row in unassigned_rows
        ],
    }
