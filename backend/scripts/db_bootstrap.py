"""db_bootstrap.py — 部署前数据库预检 (幂等, 可重复执行)

目的: 让 `alembic upgrade head` 在任意状态下都能安全执行:

  1. 全新数据库 (无业务表, 无 alembic_version)
        -> 不做任何事, 交给 `alembic upgrade head` 建表并自动 stamp head。
  2. 已迁移数据库 (alembic_version 已有记录)
        -> 不做任何事。
  3. 遗留数据库 (业务表已存在, 但 alembic_version 为空)
        旧版本后端在启动时通过 Base.metadata.create_all 直接建表, 以及早期的
        init.sql 手动建表, 都不会写入 alembic_version。此时直接 `alembic upgrade
        head` 会尝试重建初始表结构, 报错 "Table 'X' already exists"。
        这里自动把基线 f6a07e5dea48 stamp 为"已应用", 使 `alembic upgrade head`
        只补跑后续增量迁移 (如 viewer_key 补列, 该迁移本身已幂等)。

用法 (在 backend 容器内):
    python scripts/db_bootstrap.py
"""
import asyncio
import subprocess
import sys
from pathlib import Path

# Make the backend package root importable when run as a standalone script
# (python scripts/db_bootstrap.py ...), where sys.path[0] would otherwise be
# the scripts/ directory instead of the project root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text

from app.database import engine

# 与 migrations/versions/f6a07e5dea48_initial_schema.py 对应的基线 revision
BASELINE = "f6a07e5dea48"
# 用于判断"遗留数据库"的核心业务表 (由旧 create_all / init.sql 建立)
LEGACY_CORE_TABLES = ("categories", "users", "articles")


async def _alembic_version_present(conn) -> bool:
    try:
        row = await conn.execute(text("SELECT 1 FROM alembic_version LIMIT 1"))
        return row.first() is not None
    except Exception:
        # alembic_version 表不存在 -> 视为未迁移
        return False


async def _legacy_core_tables_present(conn) -> bool:
    tables = await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).get_table_names()
    )
    return all(t in tables for t in LEGACY_CORE_TABLES)


async def main() -> int:
    async with engine.connect() as conn:
        has_version = await _alembic_version_present(conn)
        if has_version:
            print("[db_bootstrap] alembic_version 已存在, 跳过 stamp。")
            return 0
        has_core = await _legacy_core_tables_present(conn)

    if has_core:
        print(
            f"[db_bootstrap] 检测到遗留业务表但 alembic_version 为空 -> "
            f"stamp 基线 {BASELINE}"
        )
        # 用当前解释器跑 alembic 模块, 避免依赖 PATH 中的 alembic 可执行文件
        # (容器 / venv / Windows 下更稳妥)。
        subprocess.run([sys.executable, "-m", "alembic", "stamp", BASELINE], check=True)
    else:
        print("[db_bootstrap] 全新数据库, 交由 `alembic upgrade head` 建表。")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
