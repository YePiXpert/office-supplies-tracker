from pathlib import Path
from uuid import uuid4

import aiosqlite
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError as SAIntegrityError

from api_utils import (
    MAX_DOCUMENT_UPLOAD_BYTES,
    build_upload_path,
    safe_unlink,
    save_upload_file_with_limit,
)
from app_locks import DATA_MUTATION_LOCK
from db.operations import create_import_task_run_sync, update_import_task_run_sync
from gemini_ocr import GeminiParseError, parse_document_with_gemini
from import_flow import build_preview_data, confirm_import_payload, normalize_import_payload
from parser import parse_document
from schemas import DuplicateHandleRequest, ImportConfirmRequest
from task_registry import TaskRegistry

router = APIRouter(prefix="/api")
_DEFAULT_UPLOAD_ENGINE = "local"
_DEFAULT_LLM_PROTOCOL = "openai"
TASK_REGISTRY = TaskRegistry(
    max_tasks=200,
    active_ttl_seconds=6 * 60 * 60,
    terminal_ttl_seconds=30 * 60,
)


def _friendly_task_error_detail(error: Exception) -> str:
    if isinstance(error, TimeoutError):
        return "解析超时，请稍后重试，或切换为手动录入。"
    raw = str(error or "").strip()
    if not raw:
        return "解析失败，请稍后重试，或切换为手动录入。"
    return raw[:300]


def _normalize_payload_from_fields(
    *,
    serial_number,
    department,
    handler,
    request_date,
    items,
) -> dict:
    return normalize_import_payload(
        {
            "serial_number": serial_number or "",
            "department": department or "",
            "handler": handler or "",
            "request_date": request_date or "",
            "items": items or [],
        }
    )


def _normalize_payload_from_parse_result(result: dict) -> dict:
    return _normalize_payload_from_fields(
        serial_number=result.get("serial_number", ""),
        department=result.get("department", ""),
        handler=result.get("handler", ""),
        request_date=result.get("request_date", ""),
        items=result.get("items", []),
    )


def _normalize_payload_from_items_data(items_data: list[dict]) -> dict:
    first = items_data[0] if items_data else {}
    return _normalize_payload_from_fields(
        serial_number=first.get("serial_number", ""),
        department=first.get("department", ""),
        handler=first.get("handler", ""),
        request_date=first.get("request_date", ""),
        items=items_data,
    )


async def _confirm_import_with_lock(
    normalized_payload: dict,
    duplicate_action: str | None,
    *,
    failure_prefix: str,
) -> dict:
    try:
        async with DATA_MUTATION_LOCK:
            return await confirm_import_payload(normalized_payload, duplicate_action)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except (aiosqlite.IntegrityError, SAIntegrityError) as exc:
        if "UNIQUE constraint failed" in str(exc):
            raise HTTPException(
                status_code=409,
                detail="导入触发唯一约束冲突（流水号+物品名称+经办人）。",
            )
        raise HTTPException(status_code=400, detail="导入失败：字段值不合法。")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"{failure_prefix}: {exc}")


def _normalize_engine(raw_engine: str | None) -> str:
    engine = str(raw_engine or "").strip().lower()
    if engine in {"local", "cloud"}:
        return engine
    if engine == "gemini":
        return "cloud"
    return _DEFAULT_UPLOAD_ENGINE


def _normalize_protocol(raw_protocol: str | None) -> str:
    protocol = str(raw_protocol or "").strip().lower()
    if protocol in {"google", "openai", "anthropic"}:
        return protocol
    return _DEFAULT_LLM_PROTOCOL


def _parse_by_engine(
    file_path: Path,
    *,
    engine: str,
    protocol: str,
    api_key: str | None = None,
    model_name: str | None = None,
    base_url: str | None = None,
) -> dict:
    normalized_engine = _normalize_engine(engine)
    if normalized_engine == "cloud":
        return parse_document_with_gemini(
            file_path,
            protocol=_normalize_protocol(protocol),
            api_key_override=api_key,
            model_name_override=model_name,
            base_url_override=base_url,
        )
    return parse_document(str(file_path))


def _run_parse_task(
    task_id: str,
    file_path: Path,
    engine: str,
    protocol: str,
    api_key: str,
    model_name: str,
    base_url: str,
) -> None:
    TASK_REGISTRY.update(task_id, status="processing", result=None)
    create_import_task_run_sync(
        task_id=task_id,
        file_name=file_path.name,
        engine=engine,
        protocol=protocol,
        status="processing",
    )
    try:
        parsed = _parse_by_engine(
            file_path,
            engine=engine,
            protocol=protocol,
            api_key=api_key,
            model_name=model_name,
            base_url=base_url,
        )
        normalized_payload = _normalize_payload_from_parse_result(parsed)
        preview_data = build_preview_data(normalized_payload, normalized_payload["items"])
        TASK_REGISTRY.update(
            task_id,
            status="completed",
            result={
                "message": f"解析完成，共 {len(preview_data['items'])} 条，请确认后导入",
                "parsed_data": preview_data,
                "has_duplicates": False,
                "requires_confirmation": True,
            },
        )
        update_import_task_run_sync(
            task_id=task_id,
            status="completed",
            item_count=len(preview_data["items"]),
        )
    except GeminiParseError as exc:
        TASK_REGISTRY.update(
            task_id,
            status="failed",
            result={"detail": str(exc)},
        )
        update_import_task_run_sync(
            task_id=task_id,
            status="failed",
            error_detail=str(exc),
        )
    except Exception as exc:
        detail = _friendly_task_error_detail(exc)
        TASK_REGISTRY.update(
            task_id,
            status="failed",
            result={"detail": detail},
        )
        update_import_task_run_sync(
            task_id=task_id,
            status="failed",
            error_detail=detail,
        )
    finally:
        safe_unlink(file_path)


@router.post("/upload", status_code=202)
@router.post("/upload-ocr", status_code=202)
async def upload_and_parse(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    engine: str = Form(default=_DEFAULT_UPLOAD_ENGINE),
    protocol: str = Form(default=_DEFAULT_LLM_PROTOCOL),
    api_key: str = Form(default=""),
    model_name: str = Form(default=""),
    base_url: str = Form(default=""),
):
    file_path = build_upload_path(file.filename or "")
    normalized_engine = _normalize_engine(engine)
    normalized_protocol = _normalize_protocol(protocol)
    normalized_api_key = str(api_key or "").strip()
    normalized_model_name = str(model_name or "").strip()
    normalized_base_url = str(base_url or "").strip()

    try:
        save_upload_file_with_limit(
            file,
            file_path,
            max_bytes=MAX_DOCUMENT_UPLOAD_BYTES,
            file_label="上传文件",
        )
        task_id = uuid4().hex
        TASK_REGISTRY.create(task_id)
        create_import_task_run_sync(
            task_id=task_id,
            file_name=file.filename or file_path.name,
            engine=normalized_engine,
            protocol=normalized_protocol,
            status="pending",
        )
        background_tasks.add_task(
            _run_parse_task,
            task_id,
            file_path,
            normalized_engine,
            normalized_protocol,
            normalized_api_key,
            normalized_model_name,
            normalized_base_url,
        )
        return {"task_id": task_id}
    except HTTPException:
        safe_unlink(file_path)
        raise
    except Exception as exc:
        safe_unlink(file_path)
        raise HTTPException(
            status_code=500,
            detail=f"解析任务创建失败，请稍后重试。{_friendly_task_error_detail(exc)}",
        )
    finally:
        await file.close()


@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    task = TASK_REGISTRY.get(task_id)
    if task is None:
        raise HTTPException(
            status_code=404,
            detail="任务不存在、已过期，或服务已重启，请重新上传文件",
        )
    return {
        "task_id": task_id,
        **task,
    }


@router.post("/import/confirm")
async def confirm_import(request: ImportConfirmRequest):
    payload = request.model_dump()
    duplicate_action = payload.pop("duplicate_action", None)
    normalized_payload = normalize_import_payload(payload)
    return await _confirm_import_with_lock(
        normalized_payload,
        duplicate_action,
        failure_prefix="导入失败",
    )


@router.post("/upload/handle-duplicates")
async def handle_duplicates(request: DuplicateHandleRequest):
    normalized_payload = _normalize_payload_from_items_data(request.items_data)
    return await _confirm_import_with_lock(
        normalized_payload,
        request.action,
        failure_prefix="处理失败",
    )
