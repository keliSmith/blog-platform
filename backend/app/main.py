"""FastAPI application entry point."""

import logging
import subprocess
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import register_routers
from app.config import settings
from app.exceptions import http_exception_handler, validation_exception_handler
from app.middleware import UploadURLRewriterMiddleware


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup / shutdown lifecycle."""
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    # Auto-create tables when using SQLite (dev / testing)
    from app.database import Base, engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Upload URL rewriting ---
app.add_middleware(UploadURLRewriterMiddleware)

# --- Exception handlers ---
app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]

# --- Register API routers ---
for router in register_routers():
    app.include_router(router)

# --- Static files ---
uploads_dir = Path(settings.UPLOAD_FOLDER)
if uploads_dir.is_dir():
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/")
async def root():
    return {"message": "Blog API Running"}


def _detect_git_commit() -> str:
    """Return the current git short commit of the repo, or 'unknown'."""
    try:
        repo_root = Path(__file__).resolve().parent.parent.parent
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(repo_root),
            stderr=subprocess.DEVNULL,
        )
        return out.decode().strip() or "unknown"
    except Exception:
        return "unknown"


# Captured once at process startup so a stale (orphan) worker can be
# distinguished from a freshly started one.
STARTED_AT = datetime.now(timezone.utc).isoformat()
GIT_COMMIT = _detect_git_commit()


@app.get("/api/health")
async def health_check():
    """Liveness probe used by scripts/health_check.ps1.

    Also reports the running code version (commit + started_at) so a
    stale backend (orphan uvicorn worker running old code) can be
    detected at a glance via scripts/check-backend.ps1.
    """
    return {
        "status": "ok",
        "commit": GIT_COMMIT,
        "started_at": STARTED_AT,
    }
