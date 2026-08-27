"""FastAPI 入口：/parse 解析单据，/health 健康检查。仅供内网 API 网关调用。"""

from __future__ import annotations

import os

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile

from .ocr import is_engine_ready
from .pipeline import parse_dispatch

app = FastAPI(title="Procure Lite OCR", version="2.0.0")

API_KEY = os.environ.get("OCR_API_KEY", "dev-ocr-key")
MAX_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "30")) * 1024 * 1024
ALLOWED_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".txt"}


def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not API_KEY or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="无效的 API Key")


@app.get("/health")
async def health():
    return {"ok": True, "ocr_loaded": is_engine_ready()}


@app.post("/parse", dependencies=[Depends(verify_api_key)])
async def parse(file: UploadFile = File(...)):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型 {ext}")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="文件过大")
    if not data:
        raise HTTPException(status_code=400, detail="文件为空")

    try:
        result = await parse_dispatch(data, filename)
    except Exception as e:  # noqa: BLE001 — 顶层兜底，给调用方明确错误
        raise HTTPException(status_code=422, detail=f"解析失败：{e}") from e
    return result
