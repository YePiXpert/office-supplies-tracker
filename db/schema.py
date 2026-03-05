import aiosqlite

from .constants import DB_PATH


async def _get_existing_columns(db: aiosqlite.Connection, table: str) -> set[str]:
    async with db.execute(f"PRAGMA table_info({table})") as cursor:
        rows = await cursor.fetchall()
    return {str(row[1]) for row in rows}


async def _ensure_item_columns(db: aiosqlite.Connection) -> None:
    existing_columns = await _get_existing_columns(db, "items")
    expected_columns = {
        "arrival_date": "TEXT",
        "distribution_date": "TEXT",
        "signoff_note": "TEXT",
        "deleted_at": "TIMESTAMP",
    }
    for column_name, column_type in expected_columns.items():
        if column_name in existing_columns:
            continue
        await db.execute(f"ALTER TABLE items ADD COLUMN {column_name} {column_type}")


async def _drop_recipient_column(db: aiosqlite.Connection) -> None:
    existing_columns = await _get_existing_columns(db, "items")
    if "recipient" not in existing_columns:
        return

    await db.execute("PRAGMA foreign_keys=OFF")
    try:
        await db.execute("DROP TABLE IF EXISTS items__new")
        await db.execute(
            """
            CREATE TABLE items__new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                serial_number TEXT NOT NULL,
                department TEXT NOT NULL,
                handler TEXT NOT NULL,
                request_date TEXT NOT NULL,
                item_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                purchase_link TEXT,
                unit_price REAL,
                status TEXT NOT NULL DEFAULT '待采购',
                invoice_issued BOOLEAN DEFAULT 0,
                payment_status TEXT NOT NULL DEFAULT '未付款',
                arrival_date TEXT,
                distribution_date TEXT,
                signoff_note TEXT,
                deleted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(serial_number, item_name, handler)
            )
            """
        )
        await db.execute(
            """
            INSERT INTO items__new (
                id, serial_number, department, handler, request_date,
                item_name, quantity, purchase_link, unit_price,
                status, invoice_issued, payment_status,
                arrival_date, distribution_date, signoff_note,
                deleted_at,
                created_at, updated_at
            )
            SELECT
                id, serial_number, department, handler, request_date,
                item_name, quantity, purchase_link, unit_price,
                status, invoice_issued, payment_status,
                arrival_date, distribution_date, signoff_note,
                NULL AS deleted_at,
                created_at, updated_at
            FROM items
            """
        )
        await db.execute("DROP TABLE items")
        await db.execute("ALTER TABLE items__new RENAME TO items")
    finally:
        await db.execute("PRAGMA foreign_keys=ON")


async def _migrate_legacy_statuses(db: aiosqlite.Connection) -> None:
    # 兼容历史状态命名，迁移到新的执行流状态。
    await db.execute("UPDATE items SET status = '待到货' WHERE status = '已采购'")
    await db.execute("UPDATE items SET status = '待到货' WHERE status = '已下单'")
    await db.execute("UPDATE items SET status = '待分发' WHERE status = '已到货'")
    await db.execute("UPDATE items SET status = '已分发' WHERE status = '已发放'")


async def _ensure_audit_log_table(db: aiosqlite.Connection) -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            changed_fields TEXT NOT NULL,
            operator_ip TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


async def init_db():
    """初始化数据库表。"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                serial_number TEXT NOT NULL,
                department TEXT NOT NULL,
                handler TEXT NOT NULL,
                request_date TEXT NOT NULL,
                item_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                purchase_link TEXT,
                unit_price REAL,
                status TEXT NOT NULL DEFAULT '待采购',
                invoice_issued BOOLEAN DEFAULT 0,
                payment_status TEXT NOT NULL DEFAULT '未付款',
                arrival_date TEXT,
                distribution_date TEXT,
                signoff_note TEXT,
                deleted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(serial_number, item_name, handler)
            )
            """
        )
        await _drop_recipient_column(db)
        await _ensure_item_columns(db)
        await _migrate_legacy_statuses(db)
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS item_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER,
                action TEXT NOT NULL,
                serial_number TEXT,
                department TEXT,
                handler TEXT,
                item_name TEXT,
                changed_fields TEXT,
                before_data TEXT,
                after_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        await _ensure_audit_log_table(db)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_items_department ON items(department)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_items_request_date ON items(request_date)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_items_serial_number ON items(serial_number)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_items_handler ON items(handler)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items(deleted_at)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_item_history_created_at ON item_history(created_at DESC)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_item_history_action ON item_history(action)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_item_history_item_id ON item_history(item_id)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id_created_at ON audit_logs(record_id, created_at DESC)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)"
        )
        await db.commit()
