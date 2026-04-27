import re
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .constants import DB_PATH


ASYNC_SQLALCHEMY_URL = f"sqlite+aiosqlite:///{Path(DB_PATH).resolve().as_posix()}"


async_engine = create_async_engine(
    ASYNC_SQLALCHEMY_URL,
    future=True,
)


AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


def _convert_placeholders(sql: str, params: list) -> tuple[str, dict]:
    """将 ? 占位符 SQL 转换为 :named 风格。"""
    counter = [0]
    param_map: dict[str, Any] = {}

    def _replace(_match):
        idx = counter[0]
        key = f"p{idx}"
        param_map[key] = params[idx]
        counter[0] += 1
        return f":{key}"

    converted = re.sub(r"\?", _replace, sql)
    return converted, param_map


async def execute_sql(sql: str, params: Optional[list] = None) -> list[dict]:
    """在 AsyncSession 中执行 raw SQL 查询，返回 dict 列表。"""
    params = params or []
    converted_sql, named_params = _convert_placeholders(sql, params)
    async with AsyncSessionLocal() as session:
        result = await session.execute(sa_text(converted_sql), named_params)
        return [dict(row) for row in result.mappings().all()]


async def execute_sql_scalar(sql: str, params: Optional[list] = None) -> Any:
    """在 AsyncSession 中执行 raw SQL 查询，返回标量值。"""
    params = params or []
    converted_sql, named_params = _convert_placeholders(sql, params)
    async with AsyncSessionLocal() as session:
        result = await session.execute(sa_text(converted_sql), named_params)
        return result.scalar_one()


async def execute_write_sql(sql: str, params: Optional[list] = None) -> int:
    """在 AsyncSession 中执行 raw SQL 写入。

    INSERT 返回新行 id，UPDATE/DELETE 返回影响行数。
    """
    params = params or []
    is_insert = sql.lstrip().upper().startswith("INSERT")
    converted_sql, named_params = _convert_placeholders(sql, params)
    async with AsyncSessionLocal() as session:
        result = await session.execute(sa_text(converted_sql), named_params)
        await session.commit()
        if is_insert:
            lastrowid = getattr(result, "lastrowid", None)
            if lastrowid is not None:
                return int(lastrowid)
        return result.rowcount
