from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from auth_security import (
    AUTH_COOKIE_NAME,
    clear_auth_cookie,
    generate_recovery_code,
    hash_secret,
    normalize_recovery_code,
    set_auth_cookie,
    verify_auth_cookie,
    verify_secret,
)
from database import (
    append_auth_audit_log,
    clear_login_lock_state,
    get_lock_remaining_seconds,
    get_system_security,
    initialize_system_security,
    is_system_initialized,
    register_failed_login_attempt,
    update_security_credentials,
)
from schemas import AuthLoginRequest, AuthRecoverRequest, AuthSetupRequest


router = APIRouter(prefix="/api/auth")


def _normalize_password(value: str) -> str:
    password = str(value or "").strip()
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="密码长度至少 8 位")
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="密码长度不能超过 128 位")
    return password


async def _safe_append_auth_audit(action: str, detail: dict) -> None:
    try:
        await append_auth_audit_log(action, detail)
    except Exception:
        # 审计失败不阻断鉴权主流程，避免影响管理员紧急登录/找回。
        return


@router.get("/status")
async def auth_status(request: Request):
    initialized = await is_system_initialized()
    authenticated = False
    lock_seconds = 0

    if initialized:
        token = request.cookies.get(AUTH_COOKIE_NAME)
        authenticated = bool(verify_auth_cookie(token))
        lock_seconds = await get_lock_remaining_seconds()

    return {
        "initialized": initialized,
        "authenticated": authenticated,
        "lock_seconds": lock_seconds,
    }


@router.post("/setup")
async def auth_setup(request: AuthSetupRequest):
    if await is_system_initialized():
        raise HTTPException(status_code=409, detail="系统已完成初始化")

    password = _normalize_password(request.password)
    recovery_code = generate_recovery_code()

    try:
        await initialize_system_security(
            password_hash=hash_secret(password),
            recovery_code_hash=hash_secret(recovery_code),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    await _safe_append_auth_audit("AUTH_SETUP", {"result": "initialized"})
    response = JSONResponse(
        {
            "message": "管理员密码初始化成功",
            "recovery_code": recovery_code,
        }
    )
    set_auth_cookie(response, subject="admin")
    return response


@router.post("/login")
async def auth_login(request: AuthLoginRequest):
    security = await get_system_security()
    if not security:
        raise HTTPException(status_code=400, detail="系统尚未初始化，请先设置管理员密码")

    locked_seconds = await get_lock_remaining_seconds()
    if locked_seconds > 0:
        raise HTTPException(
            status_code=423,
            detail=f"登录已锁定，请在 {locked_seconds} 秒后重试",
        )

    password = str(request.password or "").strip()
    if not verify_secret(password, str(security.get("password_hash") or "")):
        failure = await register_failed_login_attempt()
        if failure.get("locked_seconds", 0) > 0:
            locked = int(failure["locked_seconds"])
            raise HTTPException(
                status_code=423,
                detail=f"连续输错过多，已锁定 {locked} 秒",
            )
        attempts_left = int(failure.get("attempts_left", 0))
        raise HTTPException(
            status_code=401,
            detail=f"密码错误，还可尝试 {attempts_left} 次",
        )

    await clear_login_lock_state()
    await _safe_append_auth_audit("AUTH_LOGIN", {"result": "success"})
    response = JSONResponse({"message": "登录成功"})
    set_auth_cookie(response, subject="admin")
    return response


@router.post("/logout")
async def auth_logout():
    await _safe_append_auth_audit("AUTH_LOGOUT", {"result": "success"})
    response = JSONResponse({"message": "已退出登录"})
    clear_auth_cookie(response)
    return response


@router.post("/recover")
async def auth_recover(request: AuthRecoverRequest):
    security = await get_system_security()
    if not security:
        raise HTTPException(status_code=400, detail="系统尚未初始化，无法找回密码")

    normalized_code = normalize_recovery_code(request.recovery_code)
    if not verify_secret(normalized_code, str(security.get("recovery_code_hash") or "")):
        raise HTTPException(status_code=401, detail="恢复码无效")

    password = _normalize_password(request.new_password)
    new_recovery_code = generate_recovery_code()
    await update_security_credentials(
        password_hash=hash_secret(password),
        recovery_code_hash=hash_secret(new_recovery_code),
    )
    await _safe_append_auth_audit("AUTH_RECOVER", {"result": "success"})

    response = JSONResponse(
        {
            "message": "密码已重置，请保存新的恢复码",
            "recovery_code": new_recovery_code,
        }
    )
    set_auth_cookie(response, subject="admin")
    return response
