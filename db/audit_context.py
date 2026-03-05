from contextvars import ContextVar, Token
from typing import Optional


_operator_ip_ctx: ContextVar[Optional[str]] = ContextVar("audit_operator_ip", default=None)


def set_current_operator_ip(ip: Optional[str]) -> Token:
    value = (ip or "").strip() or None
    return _operator_ip_ctx.set(value)


def reset_current_operator_ip(token: Token) -> None:
    _operator_ip_ctx.reset(token)


def get_current_operator_ip() -> str:
    return _operator_ip_ctx.get() or "unknown"
