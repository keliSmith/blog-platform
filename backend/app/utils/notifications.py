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

    # SMS via a real gateway. Two Aliyun providers are implemented:
    #   SMS_PROVIDER=aliyun  -> Aliyun DysmsAPI SendSms (企业实名，需签名+模板)
    #   SMS_PROVIDER=dypns   -> 号码认证服务·短信认证 SendSmsVerifyCode
    #                         (个人开发者友好：免签名/模板，用控制台赠送资源)
    SMS_BACKEND=provider
    SMS_PROVIDER=aliyun
    SMS_ACCESS_KEY=*****          # Aliyun AccessKeyId
    SMS_SECRET=*****              # Aliyun AccessKeySecret
    # 对于 dypns：SMS_SIGN_NAME / SMS_TEMPLATE_CODE 填 DYPNS 控制台「赠送签名/
    # 模板」里复制的值（不是你自己申请的，个人无法申请签名）。
    SMS_SIGN_NAME=Blog            # DysmsAPI: 已审核签名 / DYPNS: 赠送签名名
    SMS_TEMPLATE_CODE=SMS_xxxx    # DysmsAPI: 默认模板 / DYPNS: 赠送模板 CODE
    # Optional per-purpose template overrides (recommended — Aliyun templates
    # are typically purpose-specific):
    # SMS_TEMPLATE_REGISTER=SMS_xxxx_register
    # SMS_TEMPLATE_RESET=SMS_xxxx_reset
    # SMS_TEMPLATE_VERIFY=SMS_xxxx_verify
"""

from __future__ import annotations

import asyncio
import json
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Literal

from app.config import settings

logger = logging.getLogger(__name__)

Channel = Literal["email", "sms"]
Purpose = Literal["register", "reset", "verify"]

_PURPOSE_TEXT: dict[str, str] = {
    "register": "注册账号",
    "reset": "重置密码",
    "verify": "验证联系方式",
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
    """Dispatch a verification code through the configured SMS provider.

    Implemented providers:
      * ``aliyun`` — Aliyun DysmsAPI ``SendSms`` (enterprise real-name,
        signature + template required).
      * ``dypns`` — Aliyun 号码认证服务·短信认证 ``SendSmsVerifyCode``
        (personal-developer friendly: no signature/template application).

    Unknown / empty providers fall back to the console backend so the flow
    still works for local development. Runs inside a thread (via
    :func:`asyncio.to_thread`), so it may perform blocking I/O.
    """
    provider = (settings.SMS_PROVIDER or "").lower()
    if provider in ("aliyun", "ali", "alibaba"):
        _send_sms_aliyun(target, code, purpose)
    elif provider in ("dypns", "aliyun_dypns", "dypnsapi"):
        _send_sms_dypns(target, code, purpose)
    else:
        logger.warning(
            "SMS_PROVIDER=%r not implemented; falling back to console for target=%s",
            settings.SMS_PROVIDER,
            target,
        )
        _banner("sms", target, code, purpose)


def _aliyun_template_for(purpose: str) -> str:
    """Pick the Aliyun template code for a purpose.

    Per-purpose overrides (SMS_TEMPLATE_REGISTER / _RESET / _VERIFY) take
    precedence; everything falls back to the shared SMS_TEMPLATE_CODE.
    """
    if purpose == "register":
        return settings.SMS_TEMPLATE_REGISTER or settings.SMS_TEMPLATE_CODE
    if purpose == "reset":
        return settings.SMS_TEMPLATE_RESET or settings.SMS_TEMPLATE_CODE
    if purpose == "verify":
        return settings.SMS_TEMPLATE_VERIFY or settings.SMS_TEMPLATE_CODE
    return settings.SMS_TEMPLATE_CODE


def _percent_encode(value: str) -> str:
    """Aliyun RPC percent-encoding (RFC 3986, unreserved = A-Za-z0-9-_.~)."""
    from urllib.parse import quote

    return quote(str(value), safe="")


def _aliyun_rpc(host: str, action: str, extra: dict[str, str]) -> str:
    """Perform a signed Aliyun OpenAPI RPC call (GET) and return the body.

    Shared by DysmsAPI (``dysmsapi.aliyuncs.com``) and DYPNS
    (``dypnsapi.aliyuncs.com``). Pure stdlib: HMAC-SHA1 RPC signature +
    :mod:`urllib`, no third-party SDK.

    Raises :class:`RuntimeError` on missing credentials or a non-OK / HTTP-error
    response (the error body is captured so the caller can surface the real
    Aliyun ``Code``/``Message`` instead of a bare status code).
    """
    access_key = settings.SMS_ACCESS_KEY
    secret = settings.SMS_SECRET
    if not access_key or not secret:
        raise RuntimeError("SMS_ACCESS_KEY / SMS_SECRET not configured")

    import base64
    import datetime as _dt
    import hashlib
    import hmac
    import urllib.error
    import urllib.parse
    import urllib.request
    import uuid

    common: dict[str, str] = {
        "AccessKeyId": access_key,
        "Action": action,
        "Format": "JSON",
        "RegionId": settings.SMS_REGION_ID or "cn-hangzhou",
        "SignatureMethod": "HMAC-SHA1",
        "SignatureNonce": uuid.uuid4().hex,
        "SignatureVersion": "1.0",
        "Timestamp": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "Version": "2017-05-25",
    }
    params: dict[str, str] = {**common, **extra}

    # 1) Canonicalize: sort by key, percent-encode every k=v.
    canonical = "&".join(
        "%s=%s" % (_percent_encode(k), _percent_encode(params[k]))
        for k in sorted(params)
    )
    # 2) String to sign: METHOD & enc("/") & enc(canonical).
    string_to_sign = "GET&%s&%s" % (_percent_encode("/"), _percent_encode(canonical))
    # 3) HMAC-SHA1 with key "<Secret>&", base64 the digest.
    key = (secret + "&").encode("utf-8")
    signature = base64.b64encode(
        hmac.new(key, string_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("ascii")
    params["Signature"] = signature

    # 4) Re-encode the full param set (now including Signature) as the query.
    query = "&".join(
        "%s=%s" % (_percent_encode(k), _percent_encode(params[k]))
        for k in sorted(params)
    )
    url = "https://%s/?%s" % (host, query)
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": "blog-platform/1.0"})

    # Default: connect directly, ignoring HTTP(S)_PROXY. A localhost MITM proxy
    # (Fiddler/Charles/mitmproxy/VPN) can't forward aliyuncs.com and returns a
    # misleading 403; bypassing it avoids that. Opt back in via SMS_USE_PROXY.
    if settings.SMS_USE_PROXY:
        opener: urllib.request.OpenerDirector = urllib.request.build_opener()
    else:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=settings.SMS_TIMEOUT) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            detail = ""
        raise RuntimeError(
            "Aliyun %s HTTP %s %s | body=%s" % (action, e.code, e.reason, detail[:500])
        )
    return body


def _send_sms_aliyun(target: str, code: str, purpose: str) -> None:
    """Send a verification code via Aliyun DysmsAPI ``SendSms`` (RPC style).

    Enterprise path: requires a reviewed signature + purpose-specific template.
    """
    template_code = _aliyun_template_for(purpose)
    if not template_code:
        raise RuntimeError("SMS template code not configured for purpose=%s" % purpose)

    sign_name = settings.SMS_SIGN_NAME
    if not sign_name:
        raise RuntimeError("SMS_SIGN_NAME not configured for aliyun")

    param_key = settings.SMS_TEMPLATE_PARAM_KEY or "code"
    template_param = json.dumps(
        {param_key: code}, ensure_ascii=False, separators=(",", ":")
    )
    extra = {
        "PhoneNumbers": target,
        "SignName": sign_name,
        "TemplateCode": template_code,
        "TemplateParam": template_param,
    }
    body = _aliyun_rpc("dysmsapi.aliyuncs.com", "SendSms", extra)
    _check_aliyun_response(body, target)


def _send_sms_dypns(target: str, code: str, purpose: str) -> None:
    """Send a verification code via Aliyun DYPNS *短信认证* ``SendSmsVerifyCode``.

    This product targets **personal** developers: no enterprise real-name,
    signature, or template application — you pick a *gifted* signature + template
    from the DYPNS console and pass your own code through ``TemplateParam``.

    We keep generating / checking the code ourselves (the ``verification_code``
    table), so DYPNS is purely the delivery pipe. The gifted template exposes
    two variables: ``code`` (our OTP) and ``min`` (validity in minutes).
    """
    sign_name = settings.SMS_SIGN_NAME
    template_code = settings.SMS_TEMPLATE_CODE
    if not sign_name or not template_code:
        raise RuntimeError(
            "DYPNS requires SMS_SIGN_NAME + SMS_TEMPLATE_CODE (the gifted "
            "signature / template copied from the DYPNS console)"
        )
    ttl_minutes = settings.VERIFICATION_CODE_TTL_MINUTES or 10
    template_param = json.dumps(
        {"code": code, "min": ttl_minutes}, ensure_ascii=False, separators=(",", ":")
    )
    extra = {
        "CountryCode": "86",
        "PhoneNumber": target,
        "SignName": sign_name,
        "TemplateCode": template_code,
        "TemplateParam": template_param,
        "ValidTime": str(ttl_minutes * 60),
    }
    body = _aliyun_rpc("dypnsapi.aliyuncs.com", "SendSmsVerifyCode", extra)
    _check_aliyun_response(body, target)


def _check_aliyun_response(body: str, target: str) -> None:
    """Raise if the Aliyun/DYPNS response is not ``Code == "OK"``."""
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise RuntimeError("Aliyun SMS returned non-JSON body: %r" % body[:200])
    code = data.get("Code")
    if code != "OK":
        # Business errors (e.g. isv.BUSINESS_LIMIT_CONTROL, FUNCTION_NOT_OPENED)
        # or gateway errors surface here with their real Message.
        raise RuntimeError(
            "Aliyun SMS failed for %s: Code=%s Message=%s RequestId=%s"
            % (target, code, data.get("Message"), data.get("RequestId"))
        )


async def send_verification_code(
    channel: str, target: str, code: str, purpose: str
) -> str | None:
    """Dispatch a verification code over the configured backend.

    Failures are caught and logged so a broken mail/SMS provider never breaks
    the registration / password-reset flow (the caller still stores the code).

    Returns the error message if sending failed, otherwise ``None``. In dev
    (``EXPOSE_DEV_CODE``) the caller surfaces this so misconfiguration (bad
    template, missing RAM permission, un-whitelisted test number, ...) is
    immediately visible instead of being silently swallowed.
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
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "Failed to send %s verification to %s: %s", channel, target, exc
        )
        return str(exc)
    return None
