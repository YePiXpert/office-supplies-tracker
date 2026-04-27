import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from db import operations
from db.constants import ItemStatus


@pytest_asyncio.fixture
async def operations_db(tmp_path, monkeypatch):
    db_path = (tmp_path / "operations.db").as_posix()
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    session_factory = async_sessionmaker(
        bind=engine,
        expire_on_commit=False,
        autoflush=False,
    )
    monkeypatch.setattr(operations, "AsyncSessionLocal", session_factory)
    try:
        yield engine, session_factory
    finally:
        await engine.dispose()


async def _create_operations_schema(
    engine,
    *,
    item_updated_at: bool = True,
    order_updated_at: bool = True,
) -> None:
    item_updated_column = ", updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" if item_updated_at else ""
    order_updated_column = ", updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" if order_updated_at else ""
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE TABLE suppliers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE
                )
                """
            )
        )
        await conn.execute(
            text(
                f"""
                CREATE TABLE items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    serial_number TEXT NOT NULL,
                    department TEXT NOT NULL,
                    handler TEXT NOT NULL,
                    request_date TEXT NOT NULL,
                    item_name TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    supplier_id INTEGER,
                    supplier_name_snapshot TEXT,
                    status TEXT NOT NULL,
                    arrival_date TEXT,
                    deleted_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    {item_updated_column}
                )
                """
            )
        )
        await conn.execute(
            text(
                f"""
                CREATE TABLE purchase_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id INTEGER NOT NULL UNIQUE,
                    supplier_id INTEGER,
                    ordered_date TEXT,
                    expected_arrival_date TEXT,
                    status TEXT NOT NULL DEFAULT 'draft',
                    note TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    {order_updated_column}
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE purchase_receipts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    purchase_order_id INTEGER NOT NULL UNIQUE,
                    received_date TEXT,
                    received_quantity REAL NOT NULL DEFAULT 0,
                    note TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        await conn.execute(text("INSERT INTO suppliers (id, name) VALUES (1, '京东')"))
        await conn.execute(
            text(
                """
                INSERT INTO items (
                    id, serial_number, department, handler, request_date, item_name,
                    quantity, status, deleted_at
                )
                VALUES (1, 'S001', '研发部', '张三', '2024-01-01', '签字笔', 10, :status, NULL)
                """
            ),
            {"status": ItemStatus.PENDING.value},
        )


async def _scalar(session_factory, query: str):
    async with session_factory() as session:
        return (await session.execute(text(query))).scalar_one()


@pytest.mark.asyncio
async def test_upsert_purchase_order_updates_order_and_item_in_one_transaction(operations_db):
    engine, session_factory = operations_db
    await _create_operations_schema(engine)

    purchase_order_id = await operations.upsert_purchase_order(
        1,
        {
            "supplier_id": 1,
            "ordered_date": "2024-01-02",
            "expected_arrival_date": "2024-01-05",
            "status": "ordered",
            "note": "urgent",
        },
    )

    assert purchase_order_id == 1
    assert await _scalar(session_factory, "SELECT COUNT(1) FROM purchase_orders") == 1
    assert await _scalar(session_factory, "SELECT status FROM items WHERE id = 1") == ItemStatus.PENDING_ARRIVAL.value
    assert await _scalar(session_factory, "SELECT supplier_name_snapshot FROM items WHERE id = 1") == "京东"


@pytest.mark.asyncio
async def test_upsert_purchase_order_rolls_back_when_item_update_fails(operations_db):
    engine, session_factory = operations_db
    await _create_operations_schema(engine, item_updated_at=False)

    with pytest.raises(OperationalError):
        await operations.upsert_purchase_order(1, {"status": "ordered"})

    assert await _scalar(session_factory, "SELECT COUNT(1) FROM purchase_orders") == 0
    assert await _scalar(session_factory, "SELECT status FROM items WHERE id = 1") == ItemStatus.PENDING.value


@pytest.mark.asyncio
async def test_upsert_purchase_receipt_updates_receipt_order_and_item_in_one_transaction(operations_db):
    engine, session_factory = operations_db
    await _create_operations_schema(engine)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                INSERT INTO purchase_orders (id, item_id, status, updated_at)
                VALUES (1, 1, 'ordered', CURRENT_TIMESTAMP)
                """
            )
        )

    receipt_id = await operations.upsert_purchase_receipt(
        1,
        {"received_date": "2024-01-03", "received_quantity": 10},
    )

    assert receipt_id == 1
    assert await _scalar(session_factory, "SELECT COUNT(1) FROM purchase_receipts") == 1
    assert await _scalar(session_factory, "SELECT status FROM purchase_orders WHERE id = 1") == "received"
    assert await _scalar(session_factory, "SELECT status FROM items WHERE id = 1") == ItemStatus.PENDING_DISTRIBUTION.value
    assert await _scalar(session_factory, "SELECT arrival_date FROM items WHERE id = 1") == "2024-01-03"


@pytest.mark.asyncio
async def test_upsert_purchase_receipt_rolls_back_when_order_update_fails(operations_db):
    engine, session_factory = operations_db
    await _create_operations_schema(engine, order_updated_at=False)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                INSERT INTO purchase_orders (id, item_id, status)
                VALUES (1, 1, 'ordered')
                """
            )
        )

    with pytest.raises(OperationalError):
        await operations.upsert_purchase_receipt(
            1,
            {"received_date": "2024-01-03", "received_quantity": 10},
        )

    assert await _scalar(session_factory, "SELECT COUNT(1) FROM purchase_receipts") == 0
    assert await _scalar(session_factory, "SELECT status FROM purchase_orders WHERE id = 1") == "ordered"
    assert await _scalar(session_factory, "SELECT status FROM items WHERE id = 1") == ItemStatus.PENDING.value
