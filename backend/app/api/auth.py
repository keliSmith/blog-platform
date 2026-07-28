"""Auth routes: register (email/SMS verified), login, code sending, reset."""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select

from app.config import settings
from app.database import AsyncSession, get_session
from app.dependencies import (
    CurrentUser,
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.models.verification_code import VerificationCode
from app.schemas import ok
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    ResendVerifyRequest,
    SendCodeRequest,
    VerifyCodeRequest,
)
from app.utils.notifications import send_verification_code

router = APIRouter(tags=["auth"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_code() -> str:
    """Return a 6-digit numeric code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _contact_already_used(session: AsyncSession, channel: str, target: str) -> bool:
    col = User.email if channel == "email" else User.phone
    existing = await session.scalar(select(User.id).where(col == target))
    return existing is not None


async def _find_user_by_contact(
    session: AsyncSession, channel: str, target: str
) -> User | None:
    col = User.email if channel == "email" else User.phone
    return await session.scalar(select(User).where(col == target))


async def _rate_limited(session: AsyncSession, target: str, channel: str, purpose: str) -> bool:
    """True if a fresh code was sent too recently (respect resend window)."""
    since = _now() - timedelta(seconds=settings.VERIFICATION_CODE_RESEND_SECONDS)
    recent = await session.scalar(
        select(VerificationCode)
        .where(
            VerificationCode.target == target,
            VerificationCode.channel == channel,
            VerificationCode.purpose == purpose,
            VerificationCode.consumed == False,  # noqa: E712
            VerificationCode.created_at > since,
        )
        .order_by(VerificationCode.created_at.desc())
    )
    return recent is not None


async def _invalidate_previous_codes(
    session: AsyncSession, target: str, channel: str, purpose: str
) -> None:
    """Mark any still-valid codes for this target as consumed (single active code)."""
    rows = (
        await session.execute(
            select(VerificationCode).where(
                VerificationCode.target == target,
                VerificationCode.channel == channel,
                VerificationCode.purpose == purpose,
                VerificationCode.consumed == False,  # noqa: E712
            )
        )
    ).scalars().all()
    for row in rows:
        row.consumed = True


async def _consume_code(
    session: AsyncSession, target: str, channel: str, purpose: str, code: str
) -> tuple[bool, str | None]:
    """Verify (and consume) a code. Returns (success, error_message)."""
    now = _now()
    vc = (
        await session.execute(
            select(VerificationCode)
            .where(
                VerificationCode.target == target,
                VerificationCode.channel == channel,
                VerificationCode.purpose == purpose,
                VerificationCode.consumed == False,  # noqa: E712
                VerificationCode.expires_at > now,
            )
            .order_by(VerificationCode.created_at.desc())
        )
    ).scalar_one_or_none()

    if vc is None:
        return False, "验证码无效或已过期，请重新获取"
    if vc.attempts >= settings.VERIFICATION_CODE_MAX_ATTEMPTS:
        return False, "验证码尝试次数过多，请重新获取"
    if vc.code != code:
        vc.attempts += 1
        return False, "验证码错误"
    vc.consumed = True
    return True, None


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "avatar": user.avatar,
        "role": user.role,
        "email_verified": user.email_verified,
        "phone_verified": user.phone_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


# ---------------------------------------------------------------------------
# POST /api/auth/send-code
# ---------------------------------------------------------------------------


@router.post("/api/auth/send-code")
async def send_code(
    body: SendCodeRequest, session: AsyncSession = Depends(get_session)
):
    """Send a verification code over email or SMS.

    purpose="register": the target must NOT already be registered.
    purpose="reset":   the target MUST belong to an existing account.
    """
    target = body.target.strip()
    channel = body.channel
    purpose = body.purpose

    if purpose == "register":
        if await _contact_already_used(session, channel, target):
            msg = "邮箱已被注册" if channel == "email" else "手机号已被注册"
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    else:  # reset
        user = await _find_user_by_contact(session, channel, target)
        if user is None:
            msg = "该邮箱未注册" if channel == "email" else "该手机号未注册"
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    if await _rate_limited(session, target, channel, purpose):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="验证码发送过于频繁，请稍后再试",
        )

    await _invalidate_previous_codes(session, target, channel, purpose)

    code = _generate_code()
    expires_at = _now() + timedelta(minutes=settings.VERIFICATION_CODE_TTL_MINUTES)
    session.add(
        VerificationCode(
            target=target,
            channel=channel,
            purpose=purpose,
            code=code,
            expires_at=expires_at,
        )
    )
    await session.flush()

    # Fire-and-forget: sending must not block / break the request.
    send_error = await send_verification_code(
        channel=channel, target=target, code=code, purpose=purpose
    )

    data: dict[str, object] = {
        "expires_in": settings.VERIFICATION_CODE_TTL_MINUTES * 60,
        "delivered": send_error is None,
    }
    if settings.EXPOSE_DEV_CODE:
        # Dev convenience only — disabled in production.
        data["dev_code"] = code
        # Surface the real gateway error so misconfiguration is visible
        # immediately instead of looking like a silent success. Applies to
        # both SMS and email channels (was previously SMS-only).
        if send_error:
            data["send_error"] = send_error
            data["sms_error"] = send_error  # backward-compat alias
    return ok(data, message="验证码已发送")


# ---------------------------------------------------------------------------
# POST /api/register
# ---------------------------------------------------------------------------


@router.post("/api/register")
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    """Register a new user, verified via an email or SMS code."""
    if body.email:
        target = body.email
        channel = "email"
        code = body.email_code or ""
    else:
        target = body.phone or ""
        channel = "sms"
        code = body.phone_code or ""

    success, err = await _consume_code(session, target, channel, "register", code)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    # Username must be unique.
    if await session.scalar(select(User.id).where(User.username == body.username)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")

    # Final uniqueness check (guards against a race between send-code and register).
    if body.email and await _contact_already_used(session, "email", body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱已被注册")
    if body.phone and await _contact_already_used(session, "sms", body.phone):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号已被注册")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
    )
    if body.email:
        user.email = body.email
    else:
        user.phone = body.phone
    # NOTE: registration NO LONGER auto-marks the contact as verified (PRD §4.8).
    # The model defaults ``email_verified`` / ``phone_verified`` to False, and
    # we intentionally do NOT overwrite them here. Users must complete the
    # post-registration verification flow (verify-email / verify-phone) to flip
    # the flag, otherwise the "verified" status would be meaningless.

    session.add(user)
    await session.flush()

    token = create_access_token(user.id)
    return ok(
        {"token": token, "user": _serialize_user(user)},
        message="注册成功",
    )


# ---------------------------------------------------------------------------
# POST /api/login
# ---------------------------------------------------------------------------


@router.post("/api/login")
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    """Login and get JWT token. Accepts username, email, or phone."""
    user = await session.scalar(
        select(User).where(
            or_(
                User.username == body.username,
                User.email == body.username,
                User.phone == body.username,
            )
        )
    )

    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户不存在")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码错误")

    token = create_access_token(user.id)
    return ok({"token": token, "user": _serialize_user(user)}, message="登录成功")


# ---------------------------------------------------------------------------
# POST /api/auth/reset-password
# ---------------------------------------------------------------------------


@router.post("/api/auth/reset-password")
async def reset_password(
    body: ResetPasswordRequest, session: AsyncSession = Depends(get_session)
):
    """Reset a password after verifying the email/SMS reset code."""
    target = body.target.strip()
    channel = body.channel

    success, err = await _consume_code(session, target, channel, "reset", body.code)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    user = await _find_user_by_contact(session, channel, target)
    if user is None:
        # Shouldn't happen (send-code validated existence) but guard anyway.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="账号不存在")

    user.password_hash = hash_password(body.new_password)
    await session.flush()
    return ok(message="密码重置成功，请使用新密码登录")


# ---------------------------------------------------------------------------
# Verification: post-registration email / phone verification
# ---------------------------------------------------------------------------


async def _get_user_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def _do_verify(
    session: AsyncSession, user: User, channel: str, purpose: str, code: str
) -> dict:
    """Shared verify logic for email and phone.

    Returns the response dict. Raises HTTPException on failure. ``purpose`` is
    always ``"verify"`` here (distinct from registration / reset codes).
    """
    target = user.email if channel == "email" else user.phone
    if not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未绑定邮箱" if channel == "email" else "未绑定手机号",
        )
    # Idempotent: already-verified contacts pass through without a fresh code.
    if channel == "email" and user.email_verified:
        return ok(message="验证成功")
    if channel == "sms" and user.phone_verified:
        return ok(message="验证成功")

    success, err = await _consume_code(session, target, channel, purpose, code)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    if channel == "email":
        user.email_verified = True
    else:
        user.phone_verified = True
    await session.flush()
    return ok(message="验证成功")


@router.post("/api/auth/verify-email")
async def verify_email(
    body: VerifyCodeRequest,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Verify the logged-in user's email with a code sent to that address.

    The email is derived from the authenticated user (never the client body),
    so a user cannot verify someone else's address.
    """
    user = await _get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return await _do_verify(session, user, "email", "verify", body.code)


@router.post("/api/auth/verify-phone")
async def verify_phone(
    body: VerifyCodeRequest,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Verify the logged-in user's phone with a code sent to that number.

    The phone is derived from the authenticated user (never the client body).
    """
    user = await _get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return await _do_verify(session, user, "sms", "verify", body.code)


@router.post("/api/auth/resend-verify")
async def resend_verify(
    body: ResendVerifyRequest,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Send (or resend) a verification code for an already-registered contact.

    Body: ``{"channel": "email" | "sms"}``. The target is derived from the
    authenticated user. Rejects already-verified contacts and enforces the
    60-second resend window (returns 429 when too frequent).
    """
    user = await _get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    channel = body.channel
    target = user.email if channel == "email" else user.phone
    if not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未绑定邮箱" if channel == "email" else "未绑定手机号",
        )

    # Already verified — no point (re)sending a code.
    if channel == "email" and user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该联系方式已验证"
        )
    if channel == "sms" and user.phone_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该联系方式已验证"
        )

    if await _rate_limited(session, target, channel, "verify"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="验证码发送过于频繁，请稍后再试",
        )

    await _invalidate_previous_codes(session, target, channel, "verify")

    code = _generate_code()
    expires_at = _now() + timedelta(minutes=settings.VERIFICATION_CODE_TTL_MINUTES)
    session.add(
        VerificationCode(
            target=target,
            channel=channel,
            purpose="verify",
            code=code,
            expires_at=expires_at,
        )
    )
    await session.flush()

    # Fire-and-forget: sending must not block / break the request.
    await send_verification_code(channel=channel, target=target, code=code, purpose="verify")

    data: dict[str, object] = {"expires_in": settings.VERIFICATION_CODE_TTL_MINUTES * 60}
    if settings.EXPOSE_DEV_CODE:
        # Dev convenience only — disabled in production.
        data["dev_code"] = code
    return ok(data, message="验证码已发送")
