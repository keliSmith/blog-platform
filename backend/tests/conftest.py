"""Pytest fixtures for FastAPI async testing."""

import os

import pytest
from httpx import ASGITransport, AsyncClient

# Force testing environment BEFORE any app imports
os.environ["APP_ENV"] = "testing"

from app.database import Base, engine
from app.main import app


@pytest.fixture(scope="session")
def anyio_backend():
    """Use asyncio backend for pytest-asyncio."""
    return "asyncio"


@pytest.fixture(autouse=True)
async def setup_database():
    """Create tables before each test module, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client(setup_database):  # noqa: ARG001
    """Async HTTP test client for FastAPI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client):
    """Register + login, return Authorization headers."""
    # Register
    await client.post("/api/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "Test123456",
    })
    # Login
    resp = await client.post("/api/login", json={
        "username": "testuser",
        "password": "Test123456",
    })
    data = resp.json()
    token = data.get("data", {}).get("token", "")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def sample_article(client, auth_headers):
    """Create and return a sample article."""
    resp = await client.post("/api/articles", json={
        "title": "Test Article",
        "content": "# Hello\nThis is a test article.",
        "summary": "A test article summary.",
        "status": "published",
    }, headers=auth_headers)
    data = resp.json()
    return data.get("data", {})
