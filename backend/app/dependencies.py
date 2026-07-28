"""FastAPI dependency injection functions for auth, admin checks, and pagination."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import Cookie, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSession, get_session
from app.exceptions import UnverifiedError
from app.models.user import User

security_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录状态无效, 请重新登录",
        ) from err


# ---------------------------------------------------------------------------
# FastAPI Depends
# ---------------------------------------------------------------------------


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    token: str | None = Cookie(None, alias="access_token"),
) -> int:
    """Extract current user ID from JWT. Raises 401 if no valid token."""
    raw = None
    if credentials:
        raw = credentials.credentials
    elif token:
        raw = token

    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录后再操作",
        )

    payload = decode_access_token(raw)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录状态无效, 请重新登录",
        )
    return int(user_id)


async def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    token: str | None = Cookie(None, alias="access_token"),
) -> int | None:
    """Like get_current_user_id but returns None for anonymous requests."""
    try:
        return await get_current_user_id(credentials, token)
    except HTTPException:
        return None


CurrentUser = Annotated[int, Depends(get_current_user_id)]
OptionalUser = Annotated[int | None, Depends(get_optional_user_id)]


async def deny_if_unverified(user_id: int, session: AsyncSession) -> None:
    """Block trust-restricted actions for old, still-unverified accounts.

    Accounts that registered within ``settings.VERIFICATION_GRACE_DAYS`` keep a
    grace period so brand-new users are not instantly nagged. Once the window
    passes and *neither* email nor phone is verified, the given action
    (public comment / favorite / like) is refused with a 403 carrying
    ``data={"need_verify": True}`` so the client can guide the user to verify.
    """
    user = await session.get(User, user_id)
    if user is None:
        return
    # Already verified on either channel — always allowed.
    if user.email_verified or user.phone_verified:
        return
    grace = timedelta(days=settings.VERIFICATION_GRACE_DAYS)
    created = user.created_at or datetime.now(timezone.utc)
    # SQLite stores datetimes without tz info; normalize to UTC-aware so the
    # subtraction below is always between two offset-aware values.
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if (datetime.now(timezone.utc) - created) > grace:
        raise UnverifiedError()


async def get_current_admin(
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> int:
    """Verify the current user is an admin. Returns user_id if admin, else 403."""
    result = await session.execute(
        select(User.role).where(User.id == user_id)
    )
    role = result.scalar_one_or_none()
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足, 仅管理员可操作",
        )
    return user_id


CurrentAdmin = Annotated[int, Depends(get_current_admin)]


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


async def pagination_params(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
) -> dict:
    return {
        "page": page,
        "page_size": page_size,
        "offset": (page - 1) * page_size,
    }
