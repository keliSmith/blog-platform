"""Add the ``sort_order`` column used by tag/category drag-and-drop sorting.

The dev/SQLite databases are created via ``Base.metadata.create_all`` on
startup, which does NOT add columns to already-existing tables. This script
backfills the new column on existing SQLite databases (and is a no-op if the
column is already present).

Usage:
    python scripts/add_sort_order.py [path/to/db.sqlite ...]

With no arguments it migrates ``./dev.db`` and ``./test.db`` relative to the
backend directory.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DBS = [BACKEND_DIR / "dev.db", BACKEND_DIR / "test.db"]
TABLES = ("tags", "categories")


def migrate(db_path: Path) -> None:
    if not db_path.exists():
        print(f"[skip] {db_path} does not exist")
        return

    conn = sqlite3.connect(str(db_path))
    try:
        cur = conn.cursor()
        present = {
            row[0]
            for row in cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        for table in TABLES:
            if table not in present:
                # Table does not exist in this database (it is created fresh on
                # first run via create_all, which already includes the column).
                print(f"[skip] {db_path.name}:{table} does not exist yet")
                continue
            existing = {row[1] for row in cur.execute(f"PRAGMA table_info({table})")}
            if "sort_order" in existing:
                print(f"[ok]   {db_path.name}:{table} already has sort_order")
                continue
            # Default 0 keeps legacy rows ordered by created_at when no explicit
            # order has been set (the list endpoint orders by sort_order then
            # created_at desc).
            cur.execute(
                f"ALTER TABLE {table} ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
            )
            print(f"[migrate] {db_path.name}:{table} added sort_order (default 0)")
        conn.commit()
    finally:
        conn.close()


def main() -> None:
    paths = [Path(p) for p in sys.argv[1:]] or DEFAULT_DBS
    for p in paths:
        migrate(Path(p))


if __name__ == "__main__":
    main()
