"""Outbound notification helpers (email + SMS) for verification codes.

Both channels default to a ``console`` backend that simply *logs* the code to
the server output. This means the whole email/SMS verification flow works
out-of-the-box for local development without any third-party credentials.

To send REAL messages, configure the matching backend in ``.env``:

    # Email via SMTP (uses the stdlib smtplib — no extra dependency)
    EMAIL_BACKEND=smtp
    SMTP_HOST=smtp.example.com
    SMTP_PORT=465
    SMTP_USER=api@example.com
    SMTP_PASSWORD=*****
    SMTP_FROM=noreply@example.com
    SMTP_USE_TLS=true

    # SMS via a real gateway (Aliyun / Tencent / Twilio / ...)
    SMS_BACKEND=provider
    SMS_PROVIDER=aliyun
    SMS_ACCESS_KEY=*****
    SMS_SECRET=*****
    SMS_SIGN_NAME=Blog
    SMS_TEMPLATE_CODE=SMS_xxxx

then implement :func:`_send_sms_provider` below for your provider.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Literal

from app.config import settings

logger = logging.getLogger(__name__)

Channel = Literal["email", "sms"]
Purpose = Literal["register", "reset"]

_PURPOSE_TEXT: dict[str, str] = {
    "register": "注册账号",
    "reset": "重置密码",
}


def _banner(channel: str, target: str, code: str, purpose: str) -> None:
    """Print a highly visible dev banner so the code is easy to find."""
    label = "EMAIL" if channel == "email" else "SMS"
    note = _PURPOSE_TEXT.get(purpose, purpose)
    # Print (not only logger.info) so the code is visible even when the
    # effective log level would otherwise hide INFO records.
    print(
        "\n".join(
            [
                "=" * 56,
                f"  [{label} VERIFICATION CODE] 目的: {note}",
                f"  发送至: {target}",
                f"  验证码: {code}  (10 分钟内有效)",
                "=" * 56,
            ]
        )
    )
    logger.info("[notification] %s code %s -> %s (purpose=%s)", label, code, target, purpose)


async def _send_email_smtp(target: str, code: str, purpose: str) -> None:
    """Send the verification code via SMTP using the stdlib smtplib."""
    subject = f"[{_PURPOSE_TEXT.get(purpose, purpose)}] 你的验证码"
    body = (
        f"你的验证码是：{code}\n\n"
        f"该验证码用于{(purpose == 'reset' and '重置密码') or '注册账号'}，"
        f"有效期为 {settings.VERIFICATION_CODE_TTL_MINUTES} 分钟。\n"
        f"如非本人操作，请忽略此邮件。"
    )
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = target
    msg.set_content(body)

    def _send() -> None:
        if settings.SMTP_USE_TLS:
            with smtplib.SMTP_SSL(
                settings.SMTP_HOST, settings.SMTP_PORT, context=ssl.create_default_context()
            ) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

    await asyncio.to_thread(_send)


def _send_sms_provider(target: str, code: str, purpose: str) -> None:
    """Hook for a real SMS gateway.

    Implement your provider here (Aliyun / Tencent / Twilio / ...). The
    function is called inside a thread so it may perform blocking I/O.

    Until implemented it falls back to the console backend and warns.
    """
    logger.warning(
        "SMS_BACKEND=provider but _send_sms_provider is not implemented; "
        "falling back to console logging for target=%s",
        target,
    )
    _banner("sms", target, code, purpose)


async def send_verification_code(
    channel: str, target: str, code: str, purpose: str
) -> None:
    """Dispatch a verification code over the configured backend.

    Failures are caught and logged so a broken mail/SMS provider never breaks
    the registration / password-reset flow (the caller still stores the code).
    """
    try:
        if channel == "email":
            if settings.EMAIL_BACKEND == "smtp" and settings.SMTP_HOST:
                await _send_email_smtp(target, code, purpose)
            else:
                _banner("email", target, code, purpose)
        elif channel == "sms":
            if settings.SMS_BACKEND == "provider":
                await asyncio.to_thread(_send_sms_provider, target, code, purpose)
            else:
                _banner("sms", target, code, purpose)
        else:
            raise ValueError(f"unknown channel: {channel}")
    except Exception as exc:
        logger.exception("Failed to send %s verification to %s: %s", channel, target, exc)
