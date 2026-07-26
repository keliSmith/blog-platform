"""Backfill the new user contact columns on an EXISTING SQLite database.

The dev/SQLite databases are created via ``Base.metadata.create_all`` on
startup, which does NOT add columns to already-existing tables. This script
backfills:

- ``phone``          (nullable, unique)
- ``email_verified`` (bool, default 0)
- ``phone_verified`` (bool, default 0)

and also relaxes the ``email`` column from ``NOT NULL`` to nullable so a user
can register with a verified phone number only. (A fresh database created by
``create_all`` already has this schema, so this script is a no-op for it.)

Usage:
    python scripts/add_user_contact_columns.py [path/to/db.sqlite ...]

With no arguments it migrates ``./dev.db`` and ``./test.db`` relative to the
backend directory.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DBS = [BACKEND_DIR / "dev.db", BACKEND_DIR / "test.db"]


def _rebuild_users_make_email_nullable(cur: sqlite3.Cursor, old_columns: list[str]) -> None:
    """Recreate the users table with a nullable email and the new columns."""
    cur.execute("PRAGMA foreign_keys=OFF")
    try:
        cur.execute("ALTER TABLE users RENAME TO users_old")
        cur.execute(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(120) DEFAULT NULL UNIQUE,
                phone VARCHAR(20) DEFAULT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                avatar VARCHAR(255) DEFAULT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                email_verified TINYINT NOT NULL DEFAULT 0,
                phone_verified TINYINT NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        col_list = ", ".join(old_columns)
        cur.execute(f"INSERT INTO users ({col_list}) SELECT {col_list} FROM users_old")
        cur.execute("DROP TABLE users_old")
    finally:
        cur.execute("PRAGMA foreign_keys=ON")


def migrate(db_path: Path) -> None:
    if not db_path.exists():
        print(f"[skip] {db_path} does not exist")
        return

    conn = sqlite3.connect(str(db_path))
    try:
        cur = conn.cursor()
        tables = {row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "users" not in tables:
            # Fresh database — create_all will build the current schema on start.
            print(f"[skip] {db_path.name}: no users table yet (will be created on start)")
            return

        columns = {row[1] for row in cur.execute("PRAGMA table_info(users)")}
        # Read full column info to detect the NOT NULL flag on email.
        col_info = {row[1]: row[3] for row in cur.execute("PRAGMA table_info(users)")}
        email_not_null = col_info.get("email", 0) == 1
        old_columns = [row[1] for row in cur.execute("PRAGMA table_info(users)")]

        if "phone" in columns and not email_not_null:
            print(f"[ok]   {db_path.name}: users already migrated")
            return

        if email_not_null:
            # Hard path: rebuild to drop NOT NULL on email (and add any missing
            # columns in the process, preserving existing data).
            _rebuild_users_make_email_nullable(cur, old_columns)
            print(f"[migrate] {db_path.name}: rebuilt users — email now nullable + new columns")
        else:
            # Simple path: just add the three new columns.
            cur.execute("ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL")
            cur.execute("ALTER TABLE users ADD COLUMN email_verified TINYINT NOT NULL DEFAULT 0")
            cur.execute("ALTER TABLE users ADD COLUMN phone_verified TINYINT NOT NULL DEFAULT 0")
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")
            print(f"[migrate] {db_path.name}: added phone/email_verified/phone_verified")

        conn.commit()
    finally:
        conn.close()


def main() -> None:
    paths = [Path(p) for p in sys.argv[1:]] or DEFAULT_DBS
    for p in paths:
        migrate(Path(p))


if __name__ == "__main__":
    main()
