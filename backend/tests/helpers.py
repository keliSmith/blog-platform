"""Shared test helpers for auth flows."""

import os
import sys

from sqlalchemy import select

# Ensure this directory is importable regardless of pytest's import mode.
sys.path.insert(0, os.path.dirname(__file__))

from app.database import async_session_factory
from app.models.verification_code import VerificationCode


async def latest_code(target: str, channel: str, purpose: str) -> str | None:
    """Read the most recent unused verification code from the DB (for tests)."""
    async with async_session_factory() as session:
        vc = (
            await session.execute(
                select(VerificationCode)
                .where(
                    VerificationCode.target == target,
                    VerificationCode.channel == channel,
                    VerificationCode.purpose == purpose,
                    VerificationCode.consumed == False,  # noqa: E712
                )
                .order_by(VerificationCode.created_at.desc())
            )
        ).scalar_one_or_none()
        return vc.code if vc else None


async def register_via_email(client, username: str, email: str, password: str) -> dict:
    """Full email-verified registration flow (used by fixtures & tests)."""
    await client.post(
        "/api/auth/send-code",
        json={"target": email, "channel": "email", "purpose": "register"},
    )
    code = await latest_code(email, "email", "register")
    resp = await client.post(
        "/api/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "email_code": code,
        },
    )
    return resp.json()
