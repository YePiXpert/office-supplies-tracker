from typing import Optional

from fastapi import APIRouter, HTTPException

from api_utils import normalize_history_action, normalize_month, normalize_text_filter, validate_pagination
from database import get_item_history_page

router = APIRouter(prefix="/api")
DEFAULT_PAGE_SIZE = 20


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


@router.get("/history")
async def history_list(
    action: Optional[str] = None,
    keyword: Optional[str] = None,
    month: Optional[str] = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
):
    validate_pagination(page, page_size)
    action_val, keyword_val, month_val = _normalize_history_filters(action, keyword, month)
    items, total = await get_item_history_page(
        action=action_val, keyword=keyword_val, month=month_val, page=page, page_size=page_size
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}
