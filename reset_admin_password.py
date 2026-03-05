#!/usr/bin/env python3
import sqlite3
from pathlib import Path

from db.constants import DB_PATH


def main() -> None:
    db_path = Path(DB_PATH).resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS system_security (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                password_hash TEXT NOT NULL,
                recovery_code_hash TEXT NOT NULL,
                failed_attempts INTEGER NOT NULL DEFAULT 0,
                locked_until TIMESTAMP
            )
            """
        )
        conn.execute("DELETE FROM system_security")
        conn.commit()

    print(f"管理员认证已重置。下次启动请重新初始化密码。数据库: {db_path}")


if __name__ == "__main__":
    main()
