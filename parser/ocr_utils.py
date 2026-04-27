"""OCR 工具函数：PaddleOCR 调用、图像预处理、行分组与 UI 过滤。"""

import logging
import os
import re
import threading
from typing import Optional

logger = logging.getLogger(__name__)

_ocr = None
_ocr_init_lock = threading.Lock()


def _resolve_ocr_max_concurrent() -> int:
    raw_value = os.getenv("PARSER_OCR_MAX_CONCURRENT", "1")
    try:
        return max(1, int(raw_value))
    except (TypeError, ValueError):
        logger.warning("Invalid PARSER_OCR_MAX_CONCURRENT=%r, fallback to 1", raw_value)
        return 1


_OCR_MAX_CONCURRENT = _resolve_ocr_max_concurrent()
_ocr_semaphore = threading.BoundedSemaphore(_OCR_MAX_CONCURRENT)


def _resolve_ocr_retry_preprocess() -> bool:
    return os.getenv("PARSER_OCR_RETRY_PREPROCESS", "1").strip().lower() not in (
        "0", "false", "no",
    )


def _resolve_ocr_min_image_side() -> int:
    raw = os.getenv("PARSER_OCR_MIN_IMAGE_SIDE", "800")
    try:
        return max(1, int(raw))
    except (TypeError, ValueError):
        logger.warning("Invalid PARSER_OCR_MIN_IMAGE_SIDE=%r, fallback to 800", raw)
        return 800


def _resolve_ocr_enable_binarize() -> bool:
    return os.getenv("PARSER_OCR_ENABLE_BINARIZE", "0").strip().lower() not in (
        "0", "false", "no",
    )


_OCR_RETRY_PREPROCESS = _resolve_ocr_retry_preprocess()
_OCR_MIN_IMAGE_SIDE = _resolve_ocr_min_image_side()
_OCR_ENABLE_BINARIZE = _resolve_ocr_enable_binarize()

UI_PATTERNS = [
    r"^转发|^转事件|^回退|^指定回退|^打印|^意见|^查找",
    r"^同意|^不同意|^消息|^跟踪|^全部|^指定人",
    r"^处理后归档|^草稿|^暂存|^待办|^附言",
    r"^发起人|^附件|^隐藏|^中国瑞达|^CHINARIDA",
    r"^\d+\(\d+\)$",
    r"^《|^》|^○",
    r"^ds/",
]
UI_REGEX_PATTERNS = tuple(re.compile(pattern) for pattern in UI_PATTERNS)


def _get_ocr():
    global _ocr
    if _ocr is None:
        with _ocr_init_lock:
            if _ocr is None:
                from paddleocr import PaddleOCR
                _ocr = PaddleOCR(
                    use_angle_cls=True, lang="ch", show_log=False, use_gpu=False
                )
    return _ocr


def _run_ocr(file_path: str):
    ocr = _get_ocr()
    with _ocr_semaphore:
        return ocr.ocr(file_path, cls=True)


def _preprocess_image(
    src_path: str, min_side: int = 800, enable_binarize: bool = False
) -> str:
    import tempfile
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps

    img = Image.open(src_path)
    img = ImageOps.exif_transpose(img)
    img = img.convert("L")

    w, h = img.size
    short = min(w, h)
    if short > 0 and short < min_side:
        scale = min_side / short
        img = img.resize(
            (max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS
        )

    img = ImageEnhance.Contrast(img).enhance(1.5)
    img = img.filter(ImageFilter.SHARPEN)

    if enable_binarize:
        img = img.point(lambda x: 255 if x > 128 else 0)

    suffix = os.path.splitext(src_path)[1].lower()
    if suffix not in (".png", ".jpg", ".jpeg"):
        suffix = ".png"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    img.save(tmp_path)
    return tmp_path


def _group_ocr_by_line_with_coords(
    ocr_results: list, line_threshold: Optional[float] = None
) -> list:
    if not ocr_results:
        return []

    if line_threshold is None:
        box_heights: list[float] = []
        for item in ocr_results:
            try:
                coords = item[0]
                top = min(pt[1] for pt in coords)
                bot = max(pt[1] for pt in coords)
                h = bot - top
                if h > 0:
                    box_heights.append(h)
            except (TypeError, IndexError, ValueError):
                pass
        if box_heights:
            median_h = sorted(box_heights)[len(box_heights) // 2]
            line_threshold = max(8.0, median_h * 0.6)
        else:
            line_threshold = 20.0

    lines = []
    current_line = [ocr_results[0]]
    current_y = ocr_results[0][0][0][1]

    for item in ocr_results[1:]:
        y = item[0][0][1]
        if abs(y - current_y) <= line_threshold:
            current_line.append(item)
        else:
            current_line.sort(key=lambda x: x[0][0][0])
            lines.append(current_line)
            current_line = [item]
            current_y = y

    if current_line:
        current_line.sort(key=lambda x: x[0][0][0])
        lines.append(current_line)

    return lines


def _filter_ui_elements(lines: list) -> list:
    filtered = []
    for line in lines:
        line_text = " ".join([item[1][0] for item in line])
        if not _is_ui_text(line_text):
            filtered_items = []
            for item in line:
                text = item[1][0]
                if not _is_ui_text(text):
                    filtered_items.append(item)
            if filtered_items:
                filtered.append(filtered_items)
    return filtered


def _is_ui_text(text: str) -> bool:
    return any(pattern.search(text) for pattern in UI_REGEX_PATTERNS)


def _resolve_ocr_configs():
    """返回 OCR 运行时配置元组。"""
    return _OCR_RETRY_PREPROCESS, _OCR_MIN_IMAGE_SIDE, _OCR_ENABLE_BINARIZE
