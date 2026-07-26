"""Auth routes: register and login."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.database import AsyncSession, get_session
from app.dependencies import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas import ok
from app.schemas.auth import LoginRequest, RegisterRequest

router = APIRouter(tags=["auth"])


@router.post("/api/register")
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    """Register a new user."""
    # Check username uniqueness
    result = await session.execute(
        select(User.id).where(User.username == body.username)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")

    # Check email uniqueness
    result = await session.execute(
        select(User.id).where(User.email == body.email)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱已存在")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    session.add(user)
    await session.flush()

    return ok(message="注册成功")


@router.post("/api/login")
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    """Login and get JWT token."""
    result = await session.execute(
        select(User).where(User.username == body.username)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户不存在")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码错误")

    token = create_access_token(user.id)
    return ok({"token": token}, message="登录成功")
