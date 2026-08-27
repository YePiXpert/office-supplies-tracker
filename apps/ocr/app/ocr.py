"""PaddleOCR 引擎封装：懒加载单例 + 信号量并发限制。

测试通过 monkeypatch `run_ocr` 注入假结果，无需安装 paddle。
"""

from __future__ import annotations

import asyncio
import os
import threading
from typing import Any

_engine: Any = None
_engine_lock = threading.Lock()
_semaphore = asyncio.Semaphore(int(os.environ.get("OCR_MAX_CONCURRENT", "1")))
_engine_ready = False


def get_engine() -> Any:
    global _engine, _engine_ready
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                from paddleocr import PaddleOCR  # 重依赖，延迟导入

                _engine = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
                _engine_ready = True
    return _engine


def is_engine_ready() -> bool:
    return _engine_ready


def _run_sync(image_bytes: bytes) -> list[dict]:
    import io

    import numpy as np
    from PIL import Image

    engine = get_engine()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    result = engine.ocr(np.array(image), cls=True)
    return _to_lines(result)


def _to_lines(result: Any) -> list[dict]:
    """PaddleOCR 输出 → [{text, box}]，box 为四点坐标。"""
    lines: list[dict] = []
    if not result:
        return lines
    for page in result:
        if not page:
            continue
        entries = page[0] if isinstance(page, tuple) else page
        for entry in entries or []:
            box, (text, _conf) = entry[0], entry[1]
            if text and text.strip():
                lines.append({"text": text.strip(), "box": box})
    return lines


async def run_ocr(image_bytes: bytes) -> list[dict]:
    async with _semaphore:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _run_sync, image_bytes)


async def ocr_pdf_page(pdf_bytes: bytes, page_index: int, scale: float = 2.0) -> list[dict]:
    """把 PDF 某页栅格化后 OCR。"""
    import io

    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(pdf_bytes)
    try:
        page = pdf[page_index]
        bitmap = page.render(scale=scale)
        pil_image = bitmap.to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG")
        return await run_ocr(buf.getvalue())
    finally:
        pdf.close()
