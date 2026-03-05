from pathlib import Path

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
