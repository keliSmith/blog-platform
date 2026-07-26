"""Test authentication, registration (email/SMS verified) and password reset."""

import pytest

from helpers import latest_code, register_via_email

# ---------------------------------------------------------------------------
# Send-code
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_send_code_register_email(client):
    resp = await client.post("/api/auth/send-code", json={
        "target": "new@example.com",
        "channel": "email",
        "purpose": "register",
    })
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    # Code is stored and readable from the DB (EXPOSE_DEV_CODE is off in testing).
    assert await latest_code("new@example.com", "email", "register") is not None


@pytest.mark.anyio
async def test_send_code_register_existing_email(client):
    await register_via_email(client, "existing", "exists@example.com", "Test123456")
    resp = await client.post("/api/auth/send-code", json={
        "target": "exists@example.com",
        "channel": "email",
        "purpose": "register",
    })
    data = resp.json()
    assert data["success"] is False
    assert "邮箱已被注册" in data["message"]


@pytest.mark.anyio
async def test_send_code_reset_unknown_email(client):
    resp = await client.post("/api/auth/send-code", json={
        "target": "nobody@example.com",
        "channel": "email",
        "purpose": "reset",
    })
    data = resp.json()
    assert data["success"] is False
    assert "未注册" in data["message"]


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_register_email_success(client):
    data = await register_via_email(client, "newuser", "new@example.com", "Password123")
    assert data["success"] is True
    assert data["message"] == "注册成功"
    assert data["data"]["token"]
    assert data["data"]["user"]["email"] == "new@example.com"
    assert data["data"]["user"]["email_verified"] is True


@pytest.mark.anyio
async def test_register_phone_success(client):
    phone = "13800138000"
    await client.post("/api/auth/send-code", json={
        "target": phone, "channel": "sms", "purpose": "register"
    })
    code = await latest_code(phone, "sms", "register")
    resp = await client.post("/api/register", json={
        "username": "phoneuser",
        "password": "Password123",
        "phone": phone,
        "phone_code": code,
    })
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["user"]["phone"] == phone
    assert data["data"]["user"]["phone_verified"] is True
    assert data["data"]["user"]["email"] is None


@pytest.mark.anyio
async def test_register_duplicate_username(client):
    await register_via_email(client, "dupuser", "dup1@example.com", "Password123")
    # Second user with the same username but a fresh email + code.
    await client.post("/api/auth/send-code", json={
        "target": "dup2@example.com", "channel": "email", "purpose": "register"
    })
    code = await latest_code("dup2@example.com", "email", "register")
    resp = await client.post("/api/register", json={
        "username": "dupuser",
        "email": "dup2@example.com",
        "password": "Password123",
        "email_code": code,
    })
    data = resp.json()
    assert data["success"] is False
    assert "用户名已存在" in data["message"]


@pytest.mark.anyio
async def test_register_invalid_code(client):
    await client.post("/api/auth/send-code", json={
        "target": "bad@example.com", "channel": "email", "purpose": "register"
    })
    resp = await client.post("/api/register", json={
        "username": "baduser",
        "email": "bad@example.com",
        "password": "Password123",
        "email_code": "000000",
    })
    data = resp.json()
    assert data["success"] is False
    assert "验证码" in data["message"]


@pytest.mark.anyio
async def test_register_without_code_rejected(client):
    # Providing email but no code fails schema validation (422).
    resp = await client.post("/api/register", json={
        "username": "nocoder",
        "email": "nocoder@example.com",
        "password": "Password123",
    })
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_login_success(client):
    await register_via_email(client, "loginuser", "login@example.com", "Password123")
    resp = await client.post("/api/login", json={
        "username": "loginuser",
        "password": "Password123",
    })
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    assert "token" in data.get("data", {})


@pytest.mark.anyio
async def test_login_by_email(client):
    await register_via_email(client, "byemail", "byemail@example.com", "Password123")
    resp = await client.post("/api/login", json={
        "username": "byemail@example.com",
        "password": "Password123",
    })
    assert resp.json()["success"] is True


@pytest.mark.anyio
async def test_login_by_phone(client):
    phone = "13900139000"
    await client.post("/api/auth/send-code", json={
        "target": phone, "channel": "sms", "purpose": "register"
    })
    code = await latest_code(phone, "sms", "register")
    await client.post("/api/register", json={
        "username": "byphone",
        "password": "Password123",
        "phone": phone,
        "phone_code": code,
    })
    resp = await client.post("/api/login", json={
        "username": phone,
        "password": "Password123",
    })
    assert resp.json()["success"] is True


@pytest.mark.anyio
async def test_login_wrong_password(client):
    await register_via_email(client, "wrongpw", "wrong@example.com", "Correct123")
    resp = await client.post("/api/login", json={
        "username": "wrongpw",
        "password": "WrongPassword",
    })
    data = resp.json()
    assert data["success"] is False


# ---------------------------------------------------------------------------
# Forgot / reset password
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_forgot_and_reset_password(client):
    await register_via_email(client, "resetme", "reset@example.com", "OldPass123")
    # Request a reset code for the existing account.
    send = await client.post("/api/auth/send-code", json={
        "target": "reset@example.com", "channel": "email", "purpose": "reset"
    })
    assert send.json()["success"] is True
    code = await latest_code("reset@example.com", "email", "reset")
    assert code is not None

    # Reset password.
    reset = await client.post("/api/auth/reset-password", json={
        "target": "reset@example.com",
        "channel": "email",
        "code": code,
        "new_password": "NewPass123",
    })
    assert reset.json()["success"] is True

    # New password works.
    ok_login = await client.post("/api/login", json={
        "username": "reset@example.com", "password": "NewPass123"
    })
    assert ok_login.json()["success"] is True

    # Old password no longer works.
    bad_login = await client.post("/api/login", json={
        "username": "reset@example.com", "password": "OldPass123"
    })
    assert bad_login.json()["success"] is False


# ---------------------------------------------------------------------------
# JWT protected routes
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_jwt_protected_route_without_token(client):
    resp = await client.get("/api/me")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_jwt_protected_route_with_token(client, auth_headers):
    resp = await client.get("/api/me", headers=auth_headers)
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    assert "data" in data
