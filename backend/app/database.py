"""Async SQLAlchemy 2.0 setup — supports MySQL (asyncmy) and SQLite (aiosqlite)."""

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


def _build_async_uri(raw: str) -> str:
    """Convert a sync-friendly URI into the matching async driver URI."""
    if raw.startswith("mysql+pymysql://"):
        return raw.replace("mysql+pymysql://", "mysql+asyncmy://", 1)
    if raw.startswith("sqlite:///"):
        return raw.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    if raw.startswith("sqlite+aiosqlite"):
        return raw
    return raw


_URI = _build_async_uri(settings.SQLALCHEMY_DATABASE_URI)
_is_sqlite = "sqlite" in _URI

_engine_kwargs: dict = {
    "echo": settings.DEBUG,
    "pool_size": 1 if _is_sqlite else 10,
    "max_overflow": 0 if _is_sqlite else 20,
    "pool_recycle": 3600,
}

# SQLite needs special connect_args and does not support pool_pre_ping
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(_URI, **_engine_kwargs)

# Enable foreign key support for SQLite
if _is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency: yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
