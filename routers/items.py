from typing import Optional

import aiosqlite
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError as SAIntegrityError

from api_utils import normalize_history_action, normalize_month, normalize_text_filter
from app_locks import DATA_MUTATION_LOCK
from database import (
    ItemStatus,
    PaymentStatus,
    batch_update_items,
    count_audit_logs,
    count_deleted_items,
    count_item_history,
    count_items,
    create_item,
    delete_item,
    get_data_quality_report,
    get_amount_report,
    get_departments,
    get_audit_logs,
    get_execution_board,
    get_handlers,
    get_item,
    get_item_history,
    get_items,
    get_items_page,
    stream_items,
    get_operations_report,
    get_supplier_report,
    list_deleted_items,
    list_suppliers,
    purge_item,
    restore_item,
    rollback_item_to_history,
    get_serial_numbers,
    get_stats_summary,
    update_item,
)
from export_utils import (
    ExportDependencyError,
    build_export_content_disposition,
    build_items_excel_stream,
    build_items_excel_stream_async,
    build_supplier_report_excel_stream,
    SUPPLIER_EXPORT_DISPLAY_NAME_PREFIX,
    SUPPLIER_EXPORT_FALLBACK_FILENAME,
)
from schemas import BatchUpdateRequest, ItemCreate, ItemRollbackRequest, ItemUpdate

router = APIRouter(prefix="/api")
MIN_PAGE = 1
MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 20


def _validate_pagination(page: int, page_size: int) -> None:
    if page < MIN_PAGE:
        raise HTTPException(status_code=400, detail="page 必须 >= 1")
    if page_size < 1 or page_size > MAX_PAGE_SIZE:
        raise HTTPException(status_code=400, detail="page_size 必须在 1-200 之间")


def _is_unique_constraint_error(error: Exception) -> bool:
    return "UNIQUE constraint failed" in str(error)


def _raise_integrity_error(
    error: Exception,
    *,
    unique_message: str,
    invalid_message: str,
) -> None:
    if _is_unique_constraint_error(error):
        raise HTTPException(status_code=409, detail=unique_message)
    raise HTTPException(status_code=400, detail=invalid_message)


def _normalize_item_filters(
    status: Optional[str],
    department: Optional[str],
    month: Optional[str],
    keyword: Optional[str],
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    return (
        normalize_text_filter(status),
        normalize_text_filter(department),
        normalize_month(month),
        normalize_text_filter(keyword),
    )


def _normalize_history_filters(
    action: Optional[str],
    keyword: Optional[str],
    month: Optional[str],
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    return (
        normalize_history_action(action),
        normalize_text_filter(keyword),
        normalize_month(month),
    )


@router.get("/items")
async def list_items(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
):
    """获取所有物品列表。"""
    _validate_pagination(page, page_size)
    status, department, month, keyword = _normalize_item_filters(
        status, department, month, keyword
    )
    items, total = await get_items_page(
        status=status,
        department=department,
        month=month,
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/execution-board")
async def execution_board(
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
    limit_per_status: int = 80,
):
    """采购执行看板（按待办状态分栏）。"""
    if limit_per_status < 1 or limit_per_status > 300:
        raise HTTPException(
            status_code=400, detail="limit_per_status 必须在 1-300 之间"
        )
    _, department, month, keyword = _normalize_item_filters(
        None, department, month, keyword
    )
    return await get_execution_board(
        department=department,
        month=month,
        keyword=keyword,
        limit_per_status=limit_per_status,
    )


@router.post("/items/batch-update")
async def batch_update_items_endpoint(request: BatchUpdateRequest):
    """批量更新记录。"""
    if not request.updates:
        raise HTTPException(status_code=400, detail="updates 不能为空")
    async with DATA_MUTATION_LOCK:
        try:
            result = await batch_update_items(request.ids, request.updates)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except (aiosqlite.IntegrityError, SAIntegrityError) as e:
            _raise_integrity_error(
                e,
                unique_message="批量更新触发唯一约束冲突（流水号+物品名称+经办人）",
                invalid_message="批量更新失败：字段值不合法",
            )

    updated_count = result.get("updated_count", 0)
    unchanged_count = result.get("unchanged_count", 0)
    missing_ids = result.get("missing_ids", [])
    message = f"批量更新完成：更新 {updated_count} 条"
    if unchanged_count:
        message += f"，未变化 {unchanged_count} 条"
    if missing_ids:
        message += f"，未找到 {len(missing_ids)} 条"
    return {
        "message": message,
        **result,
    }


@router.get("/export")
async def export_items(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
):
    """导出筛选后的记录为 Excel。"""
    status, department, month, keyword = _normalize_item_filters(
        status, department, month, keyword
    )
    items = stream_items(
        status=status, department=department, month=month, keyword=keyword
    )

    try:
        output = await build_items_excel_stream_async(items)
    except ExportDependencyError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    content_disposition = build_export_content_disposition()
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": content_disposition},
    )


@router.get("/items/{item_id}")
async def read_item(item_id: int):
    """获取单个物品详情。"""
    item = await get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="物品不存在")
    return item


@router.post("/items")
async def create_new_item(item: ItemCreate):
    """手动创建新物品记录。"""
    async with DATA_MUTATION_LOCK:
        try:
            item_id = await create_item(item.model_dump())
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except (aiosqlite.IntegrityError, SAIntegrityError) as e:
            _raise_integrity_error(
                e,
                unique_message="记录已存在（流水号+物品名称+经办人）",
                invalid_message="创建失败：字段值不合法",
            )
    return {"id": item_id, "message": "创建成功"}


@router.put("/items/{item_id}")
async def update_item_endpoint(item_id: int, updates: ItemUpdate):
    """更新物品记录。"""
    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="未提供可更新字段")
    if "quantity" in update_data and update_data["quantity"] is None:
        raise HTTPException(status_code=400, detail="quantity 不能为空")
    async with DATA_MUTATION_LOCK:
        try:
            success = await update_item(item_id, update_data)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except (aiosqlite.IntegrityError, SAIntegrityError) as e:
            _raise_integrity_error(
                e,
                unique_message="记录已存在（流水号+物品名称+经办人）",
                invalid_message="更新失败：字段值不合法",
            )
    if not success:
        raise HTTPException(status_code=404, detail="物品不存在")
    return {"message": "更新成功"}


@router.delete("/items/{item_id}")
async def delete_item_endpoint(item_id: int):
    """删除物品记录。"""
    async with DATA_MUTATION_LOCK:
        success = await delete_item(item_id)
    if not success:
        raise HTTPException(status_code=404, detail="物品不存在")
    return {"message": "删除成功"}


@router.get("/recycle-bin")
async def recycle_bin_list(
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
):
    """回收站列表（软删除记录）。"""
    _validate_pagination(page, page_size)
    normalized_keyword = normalize_text_filter(keyword)
    items = await list_deleted_items(
        keyword=normalized_keyword,
        page=page,
        page_size=page_size,
    )
    total = await count_deleted_items(keyword=normalized_keyword)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/items/{item_id}/restore")
async def restore_item_endpoint(item_id: int):
    """从回收站恢复记录。"""
    async with DATA_MUTATION_LOCK:
        success = await restore_item(item_id)
    if not success:
        raise HTTPException(status_code=404, detail="回收站记录不存在")
    return {"message": "恢复成功"}


@router.delete("/recycle-bin/{item_id}")
async def purge_item_endpoint(item_id: int):
    """彻底删除回收站记录。"""
    async with DATA_MUTATION_LOCK:
        success = await purge_item(item_id)
    if not success:
        raise HTTPException(status_code=404, detail="回收站记录不存在")
    return {"message": "已彻底删除"}


@router.post("/items/{item_id}/rollback")
async def rollback_item_endpoint(item_id: int, request: ItemRollbackRequest):
    """将记录回滚到指定历史版本（before_data 快照）。"""
    async with DATA_MUTATION_LOCK:
        try:
            success = await rollback_item_to_history(item_id, request.history_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except (aiosqlite.IntegrityError, SAIntegrityError) as exc:
            _raise_integrity_error(
                exc,
                unique_message="回滚会触发唯一约束冲突（流水号+物品名称+经办人）",
                invalid_message="回滚失败：字段值不合法",
            )
    if not success:
        raise HTTPException(status_code=404, detail="物品或历史记录不存在")
    return {"message": "回滚成功"}


@router.get("/data-quality")
async def data_quality(limit: int = 200):
    """数据质量巡检报告。"""
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="limit 必须在 1-1000 之间")
    return await get_data_quality_report(limit=limit)


@router.get("/autocomplete")
async def autocomplete():
    """获取自动补全数据。"""
    return {
        "serial_numbers": await get_serial_numbers(),
        "departments": await get_departments(),
        "handlers": await get_handlers(),
        "suppliers": await list_suppliers(limit=200),
        "statuses": [s.value for s in ItemStatus],
        "payment_statuses": [s.value for s in PaymentStatus],
    }


@router.get("/stats")
async def get_stats():
    """获取统计信息。"""
    return await get_stats_summary()


@router.get("/reports/amount")
async def amount_report(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
    granularity: Optional[str] = None,
):
    """金额统计报表（支持与列表一致的筛选）。granularity=month|quarter|year"""
    status, department, month, keyword = _normalize_item_filters(
        status, department, month, keyword
    )
    normalized_granularity = str(granularity or "month").strip().lower()
    if normalized_granularity not in {"month", "quarter", "year"}:
        raise HTTPException(status_code=400, detail="granularity 仅支持 month / quarter / year")
    return await get_amount_report(
        status=status,
        department=department,
        month=month,
        keyword=keyword,
        granularity=normalized_granularity,
    )


@router.get("/reports/operations")
async def operations_report(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
):
    """执行漏斗、周期分布与月度金额趋势报表。"""
    status, department, month, keyword = _normalize_item_filters(
        status, department, month, keyword
    )
    return await get_operations_report(
        status=status, department=department, month=month, keyword=keyword
    )


@router.get("/reports/suppliers")
async def supplier_report(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
    year: Optional[str] = None,
    supplier_id: Optional[int] = None,
    granularity: Optional[str] = None,
):
    """供应商采购分析报表。granularity=month|quarter|year"""
    status, department, month, keyword = _normalize_item_filters(
        status, department, month, keyword
    )
    if supplier_id is not None and supplier_id <= 0:
        raise HTTPException(status_code=400, detail="supplier_id 必须为正整数")
    normalized_granularity = str(granularity or "month").strip().lower()
    if normalized_granularity not in {"month", "quarter", "year"}:
        raise HTTPException(status_code=400, detail="granularity 仅支持 month / quarter / year")
    return await get_supplier_report(
        status=status,
        department=department,
        month=month,
        keyword=keyword,
        year=year,
        supplier_id=supplier_id,
        granularity=normalized_granularity,
    )


@router.get("/reports/suppliers/export")
async def export_supplier_report(
    status: Optional[str] = None,
    department: Optional[str] = None,
    month: Optional[str] = None,
    keyword: Optional[str] = None,
    year: Optional[str] = None,
    supplier_id: Optional[int] = None,
    mode: Optional[str] = None,
):
    """导出供应商采购分析 Excel。"""
    status, department, month, keyword = _normalize_item_filters(
        status, department, month, keyword
    )
    if supplier_id is not None and supplier_id <= 0:
        raise HTTPException(status_code=400, detail="supplier_id 必须为正整数")

    normalized_mode = str(mode or "full").strip().lower()
    if normalized_mode not in {"full", "monthly", "quarterly", "yearly"}:
        raise HTTPException(
            status_code=400, detail="mode 仅支持 full / monthly / quarterly / yearly"
        )

    report = await get_supplier_report(
        status=status,
        department=department,
        month=month,
        keyword=keyword,
        year=year,
        supplier_id=supplier_id,
    )

    try:
        output = build_supplier_report_excel_stream(report, mode=normalized_mode)
    except ExportDependencyError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if normalized_mode == "monthly":
        display_name_prefix = f"{SUPPLIER_EXPORT_DISPLAY_NAME_PREFIX}_月度"
    elif normalized_mode == "quarterly":
        display_name_prefix = f"{SUPPLIER_EXPORT_DISPLAY_NAME_PREFIX}_季度"
    elif normalized_mode == "yearly":
        display_name_prefix = f"{SUPPLIER_EXPORT_DISPLAY_NAME_PREFIX}_年度"
    else:
        display_name_prefix = SUPPLIER_EXPORT_DISPLAY_NAME_PREFIX

    content_disposition = build_export_content_disposition(
        fallback_filename=SUPPLIER_EXPORT_FALLBACK_FILENAME,
        display_name_prefix=display_name_prefix,
    )
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": content_disposition},
    )


@router.get("/history")
async def history_list(
    action: Optional[str] = None,
    keyword: Optional[str] = None,
    month: Optional[str] = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
):
    """变更历史列表。"""
    _validate_pagination(page, page_size)
    action, keyword, month = _normalize_history_filters(action, keyword, month)
    items = await get_item_history(
        action=action, keyword=keyword, month=month, page=page, page_size=page_size
    )
    total = await count_item_history(action=action, keyword=keyword, month=month)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/audit-logs")
async def audit_logs(
    record_id: Optional[int] = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
):
    """字段级审计日志（只读）。"""
    _validate_pagination(page, page_size)
    if record_id is not None and record_id <= 0:
        raise HTTPException(status_code=400, detail="record_id 必须为正整数")
    items = await get_audit_logs(record_id=record_id, page=page, page_size=page_size)
    total = await count_audit_logs(record_id=record_id)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
