"""部门提取：从 PDF 表格和文本中提取申领部门。"""

import re

DEPARTMENT_LABEL_ALIASES = ("申领部门", "申请部门", "领用部门", "使用部门")
DEPARTMENT_LABEL_PATTERN = (
    r"(?:申\s*领\s*部\s*门|申\s*请\s*部\s*门|领\s*用\s*部\s*门|使\s*用\s*部\s*门)"
)

_DEPT_SUFFIX_HINT = re.compile(
    r"[部局处室厅委院所中心站队组科办事业]$|委员会$|管理中心$|办公室$"
)
_DATE_LIKE = re.compile(r"^[\d\-/年月日\.]+$")
_STOP_LABELS = r"(?:经办人|申领人|申请人|申领日期|日期|时间|流水号|单号|编号|联系电话|部门领导意见|管理员意见|审批意见)"


def _normalize_label_text(value: str) -> str:
    return re.sub(r"[\s:：]", "", str(value or ""))


def _contains_department_label(value: str) -> bool:
    compact = _normalize_label_text(value)
    return any(alias in compact for alias in DEPARTMENT_LABEL_ALIASES)


def _contains_opinion_label(value: str) -> bool:
    compact = _normalize_label_text(value)
    return "部门领导意见" in compact or "管理员意见" in compact


def looks_like_department(value: str) -> bool:
    if not value:
        return False
    if _DATE_LIKE.fullmatch(value):
        return False
    if _DEPT_SUFFIX_HINT.search(value):
        return True
    if len(value) < 4:
        return False
    return True


def clean_department_text(value: str) -> str:
    if not value:
        return ""
    value = str(value).replace("\n", "").replace(" ", "")
    value = value.replace("\r", "").replace("\t", "")
    value = re.sub(
        rf"^(?:.*?){DEPARTMENT_LABEL_PATTERN}[：:\s]*", "", value, count=1
    )
    value = re.split(
        _STOP_LABELS,
        value,
        maxsplit=1,
    )[0]
    value = value.strip("：:，,。；;")
    if any(
        kw in value
        for kw in (
            "部门领导", "领导意见", "管理员意见", "审批意见", "同意", "审批", "意见",
        )
    ):
        return ""
    if not value or re.fullmatch(r"[\W_]+", value):
        return ""
    return value


def extract_department_from_row_cells(row: list, start_idx: int = 0) -> str:
    if not row:
        return ""
    for idx in range(max(0, start_idx), len(row)):
        cell_text = str(row[idx] or "").strip()
        if not cell_text:
            continue
        if _contains_opinion_label(cell_text) or _contains_department_label(cell_text):
            continue
        dept = clean_department_text(cell_text)
        if dept and looks_like_department(dept):
            return dept
    return ""
