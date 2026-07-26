"""Test user authentication endpoints."""

import pytest


@pytest.mark.anyio
async def test_register_success(client):
    """User can register with valid data."""
    resp = await client.post("/api/register", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "Password123",
    })
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    assert data["message"] == "注册成功"


@pytest.mark.anyio
async def test_register_duplicate_username(client):
    """Registration fails with existing username."""
    await client.post("/api/register", json={
        "username": "dupuser",
        "email": "dup1@example.com",
        "password": "Password123",
    })
    resp = await client.post("/api/register", json={
        "username": "dupuser",
        "email": "dup2@example.com",
        "password": "Password123",
    })
    data = resp.json()
    assert data["success"] is False
    assert "用户名" in data["message"]


@pytest.mark.anyio
async def test_login_success(client):
    """User can login with correct credentials."""
    await client.post("/api/register", json={
        "username": "loginuser",
        "email": "login@example.com",
        "password": "Password123",
    })
    resp = await client.post("/api/login", json={
        "username": "loginuser",
        "password": "Password123",
    })
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    assert "token" in data.get("data", {})


@pytest.mark.anyio
async def test_login_wrong_password(client):
    """Login fails with wrong password."""
    await client.post("/api/register", json={
        "username": "wrongpw",
        "email": "wrong@example.com",
        "password": "Correct123",
    })
    resp = await client.post("/api/login", json={
        "username": "wrongpw",
        "password": "WrongPassword",
    })
    data = resp.json()
    assert data["success"] is False


@pytest.mark.anyio
async def test_jwt_protected_route_without_token(client):
    """Protected route returns 401 without JWT."""
    resp = await client.get("/api/me")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_jwt_protected_route_with_token(client, auth_headers):
    """Protected route works with valid JWT."""
    resp = await client.get("/api/me", headers=auth_headers)
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    assert "data" in data
