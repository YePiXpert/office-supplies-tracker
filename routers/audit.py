from typing import Optional

from fastapi import APIRouter, HTTPException

from api_utils import validate_pagination
from database import get_audit_logs_page

router = APIRouter(prefix="/api")
DEFAULT_PAGE_SIZE = 20


@router.get("/audit-logs")
async def audit_logs(
    record_id: Optional[int] = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
):
    validate_pagination(page, page_size)
    if record_id is not None and record_id <= 0:
        raise HTTPException(status_code=400, detail="record_id 必须为正整数")
    items, total = await get_audit_logs_page(record_id=record_id, page=page, page_size=page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}
