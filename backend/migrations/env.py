import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool

# Add the backend directory to sys.path so `app` is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Import all models so Alembic can see every table in Base.metadata
from app.database import Base  # noqa: E402
from app.models import *  # noqa: F403,E402
from app.config import settings  # noqa: E402

config = context.config

# Use the application's database URI instead of the hardcoded alembic.ini value.
# settings.SQLALCHEMY_DATABASE_URI is always an *async* URI
# (sqlite+aiosqlite:// / mysql+asyncmy://).
config.set_main_option("sqlalchemy.url", settings.SQLALCHEMY_DATABASE_URI)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emits SQL, no DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    SQLite is driven through a *synchronous* engine so that local dev works
    without the greenlet native extension (which is absent on some Windows
    setups). MySQL uses the async driver (asyncmy) — that path only runs
    inside the Linux backend container where greenlet is available.
    """
    url = settings.SQLALCHEMY_DATABASE_URI

    if url.startswith("sqlite"):
        from sqlalchemy import create_engine

        sync_url = url.replace("sqlite+aiosqlite://", "sqlite://", 1)
        connectable = create_engine(sync_url, poolclass=pool.NullPool)
        try:
            with connectable.connect() as connection:
                _do_run_migrations(connection)
        finally:
            connectable.dispose()
        return

    # MySQL (asyncmy) — async engine required; driven via asyncio.run.
    asyncio.run(_run_mysql_migrations(url))


async def _run_mysql_migrations(url: str) -> None:
    from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

    connectable: AsyncEngine = create_async_engine(url, poolclass=pool.NullPool)
    try:
        async with connectable.connect() as connection:
            await connection.run_sync(_do_run_migrations)
    finally:
        await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
