"""解析管线：PDF 文本层优先，表格/文本不足时栅格化 OCR 兜底；图片直接 OCR。"""

from __future__ import annotations

import io
import re

from .normalize import to_halfwidth
from .ocr import ocr_pdf_page, run_ocr
from .reconstruct import rebuild_from_lines, rows_from_table


async def parse_pdf(pdf_bytes: bytes) -> dict:
    import pdfplumber

    table_rows: list[dict] = []
    text_lines: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            for table in page.extract_tables():
                rows = rows_from_table(table or [])
                table_rows.extend(rows)
            page_text = page.extract_text() or ""
            for line in page_text.splitlines():
                line = to_halfwidth(line).strip()
                if line:
                    text_lines.append(line)

    if table_rows:
        result = rebuild_from_lines(text_lines)
        # 表格行的字段比纯文本行更可靠，优先用表格行
        result["items"], table_warnings = _finalize_table_items(table_rows)
        result["warnings"] = _merge_warnings(result["warnings"], table_warnings)
        result["mode"] = "PDF_TEXT"
        if not result["items"]:
            return await _pdf_ocr_fallback(pdf_bytes, page_count, text_lines)
        return result

    if len(text_lines) >= 3 and _looks_like_content(text_lines):
        result = rebuild_from_lines(text_lines)
        result["mode"] = "PDF_TEXT"
        if len(result["items"]) >= 1:
            return result
        return await _pdf_ocr_fallback(pdf_bytes, page_count, text_lines)

    return await _pdf_ocr_fallback(pdf_bytes, page_count, text_lines)


def _finalize_table_items(rows: list[dict]) -> tuple[list[dict], list[str]]:
    warnings: list[str] = []
    cleaned: list[dict] = []
    for row in rows:
        if row["quantity"] is None:
            warnings.append(f"「{row['itemName']}」未识别到数量，默认为 1")
            row["quantity"] = 1.0
        cleaned.append({k: v for k, v in row.items() if v is not None})
    if not cleaned:
        warnings.insert(0, "表格中未识别到物品明细")
    return cleaned, warnings


async def _pdf_ocr_fallback(pdf_bytes: bytes, page_count: int, text_lines: list[str]) -> dict:
    ocr_lines: list[str] = []
    for i in range(min(page_count, 10)):
        for entry in await ocr_pdf_page(pdf_bytes, i):
            ocr_lines.append(entry["text"])

    if text_lines and ocr_lines:
        result = rebuild_from_lines(text_lines + ocr_lines)
        result["mode"] = "PDF_MIXED"
        result["warnings"].append("PDF 文本层不完整，已结合 OCR 识别")
        return result
    result = rebuild_from_lines(ocr_lines or text_lines)
    result["mode"] = "PDF_OCR" if ocr_lines else "PDF_TEXT"
    if not ocr_lines:
        result["warnings"].append("未识别到文本，请检查文件")
    return result


def _looks_like_content(lines: list[str]) -> bool:
    """文本层是否包含实际内容（而不只是页眉水印/页码）。"""
    contentish = [ln for ln in lines if len(ln) >= 4 and re.search(r"[\u4e00-\u9fa5]", ln)]
    return len(contentish) >= 2


async def parse_image(image_bytes: bytes) -> dict:
    entries = await run_ocr(image_bytes)
    lines = [e["text"] for e in entries]
    result = rebuild_from_lines(lines)
    result["mode"] = "IMAGE_OCR"
    return result


async def parse_text(text: str) -> dict:
    """调试/测试用：直接传文本行。"""
    lines = [to_halfwidth(ln).strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    result = rebuild_from_lines(lines)
    result["mode"] = "TEXT"
    return result


async def parse_dispatch(data: bytes, filename: str) -> dict:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return await parse_pdf(data)
    if lower.endswith(".txt"):
        return await parse_text(data.decode("utf-8", errors="replace"))
    return await parse_image(data)
