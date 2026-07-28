"""Tests for the Aliyun SMS integration (DysmsAPI + DYPNS 短信认证) in
app.utils.notifications.

All network access is mocked (urllib.request.build_opener) so no real SMS is
sent and no external calls are made.
"""

import io
import json
import urllib.error
from unittest.mock import patch

import pytest

from app.config import settings
from app.utils import notifications as ntf


class _FakeResp:
    """Minimal context-manager response mimicking urllib's return value."""

    def __init__(self, body: str) -> None:
        self._body = body.encode("utf-8")

    def __enter__(self) -> "_FakeResp":
        return self

    def __exit__(self, *exc: object) -> bool:
        return False

    def read(self) -> bytes:
        return self._body


class _FakeOpener:
    """Stand-in for the OpenerDirector returned by build_opener.

    Records the request that was opened (so tests can inspect the URL) and
    returns ``result`` (a _FakeResp) or raises it if it is an exception.
    """

    def __init__(self, result, capture: dict | None = None) -> None:
        self._result = result
        self._capture = capture

    def open(self, req, timeout=None):  # noqa: ANN001
        if self._capture is not None:
            self._capture["url"] = req.full_url
            self._capture["method"] = req.method
        if isinstance(self._result, BaseException):
            raise self._result
        return self._result


def _ok_body() -> str:
    return json.dumps({"Code": "OK", "Message": "OK", "RequestId": "req-1"})


def _err_body(code: str = "isv.BUSINESS_LIMIT_CONTROL", msg: str = "触发分钟级流控") -> str:
    return json.dumps({"Code": code, "Message": msg, "RequestId": "req-2"})


@pytest.fixture
def aliyun_settings(monkeypatch):
    """Arm a fully-configured Aliyun backend on the singleton settings."""
    monkeypatch.setattr(settings, "SMS_BACKEND", "provider")
    monkeypatch.setattr(settings, "SMS_PROVIDER", "aliyun")
    monkeypatch.setattr(settings, "SMS_ACCESS_KEY", "AKID_TEST")
    monkeypatch.setattr(settings, "SMS_SECRET", "SECRET_TEST")
    monkeypatch.setattr(settings, "SMS_SIGN_NAME", "Blog")
    monkeypatch.setattr(settings, "SMS_REGION_ID", "cn-hangzhou")
    monkeypatch.setattr(settings, "SMS_TEMPLATE_CODE", "SMS_DEFAULT")
    monkeypatch.setattr(settings, "SMS_TEMPLATE_REGISTER", "")
    monkeypatch.setattr(settings, "SMS_TEMPLATE_RESET", "")
    monkeypatch.setattr(settings, "SMS_TEMPLATE_VERIFY", "")
    monkeypatch.setattr(settings, "SMS_TEMPLATE_PARAM_KEY", "code")
    monkeypatch.setattr(settings, "SMS_TIMEOUT", 10)
    monkeypatch.setattr(settings, "SMS_USE_PROXY", False)
    return settings


@pytest.fixture
def dypns_settings(monkeypatch):
    """Arm a fully-configured Aliyun DYPNS (短信认证) backend."""
    monkeypatch.setattr(settings, "SMS_BACKEND", "provider")
    monkeypatch.setattr(settings, "SMS_PROVIDER", "dypns")
    monkeypatch.setattr(settings, "SMS_ACCESS_KEY", "AKID_TEST")
    monkeypatch.setattr(settings, "SMS_SECRET", "SECRET_TEST")
    monkeypatch.setattr(settings, "SMS_SIGN_NAME", "GiftedSign")
    monkeypatch.setattr(settings, "SMS_TEMPLATE_CODE", "100001")
    monkeypatch.setattr(settings, "SMS_REGION_ID", "cn-hangzhou")
    monkeypatch.setattr(settings, "SMS_TIMEOUT", 10)
    monkeypatch.setattr(settings, "SMS_USE_PROXY", False)
    monkeypatch.setattr(settings, "VERIFICATION_CODE_TTL_MINUTES", 10)
    return settings


def _patch_opener(result, capture: dict | None = None):
    return patch(
        "urllib.request.build_opener", return_value=_FakeOpener(result, capture)
    )


def test_aliyun_builds_signed_request(aliyun_settings):
    captured: dict = {}
    with _patch_opener(_FakeResp(_ok_body()), capture=captured):
        ntf._send_sms_aliyun("13800138000", "123456", "register")

    url = captured["url"]
    assert captured["method"] == "GET"
    assert "Action=SendSms" in url
    assert "PhoneNumbers=13800138000" in url
    assert "SignName=Blog" in url
    assert "TemplateCode=SMS_DEFAULT" in url
    # TemplateParam carries the code as JSON, percent-encoded.
    assert "%7B%22code%22%3A%22123456%22%7D" in url  # {"code":"123456"}
    assert "RegionId=cn-hangzhou" in url
    assert "Timestamp=" in url
    assert "Signature=" in url
    sig = url.split("Signature=")[1].split("&")[0]
    assert len(sig) > 20  # base64(HMAC-SHA1) of a 28-char string


def test_aliyun_handles_failure(aliyun_settings):
    with _patch_opener(_FakeResp(_err_body())):
        with pytest.raises(RuntimeError) as exc:
            ntf._send_sms_aliyun("13800138000", "123456", "register")
    assert "BUSINESS_LIMIT_CONTROL" in str(exc.value)


def test_aliyun_http_error_surfaces_body(aliyun_settings):
    """An HTTP 4xx/5xx must report Aliyun's JSON body, not just the status."""
    body = json.dumps(
        {"Code": "Forbidden", "Message": "The access key is disabled.", "RequestId": "r-x"}
    ).encode("utf-8")
    http_err = urllib.error.HTTPError(
        "https://dysmsapi.aliyuncs.com/", 403, "Forbidden", {}, io.BytesIO(body)
    )
    with _patch_opener(http_err):
        with pytest.raises(RuntimeError) as exc:
            ntf._send_sms_aliyun("13800138000", "123456", "register")
    msg = str(exc.value)
    assert "403" in msg
    assert "The access key is disabled." in msg


def test_aliyun_runs_without_proxy_by_default(aliyun_settings, monkeypatch):
    """Default config must bypass HTTP(S)_PROXY for the Aliyun call."""
    seen = {}

    def fake_build_opener(*handlers):
        seen["handlers"] = handlers
        return _FakeOpener(_FakeResp(_ok_body()))

    with patch("urllib.request.build_opener", side_effect=fake_build_opener):
        ntf._send_sms_aliyun("13800138000", "123456", "register")
    # ProxyHandler({}) is installed -> direct connection, env proxy ignored.
    assert any(
        isinstance(h, urllib.request.ProxyHandler) and h.proxies == {}
        for h in seen["handlers"]
    )


def test_aliyun_respects_proxy_when_enabled(aliyun_settings, monkeypatch):
    monkeypatch.setattr(settings, "SMS_USE_PROXY", True)
    seen = {}

    def fake_build_opener(*handlers):
        seen["handlers"] = handlers
        return _FakeOpener(_FakeResp(_ok_body()))

    with patch("urllib.request.build_opener", side_effect=fake_build_opener):
        ntf._send_sms_aliyun("13800138000", "123456", "register")
    # No ProxyHandler({}) -> default opener that honors HTTP(S)_PROXY.
    assert not any(
        isinstance(h, urllib.request.ProxyHandler) for h in seen["handlers"]
    )


def test_aliyun_missing_config_raises(monkeypatch):
    monkeypatch.setattr(settings, "SMS_ACCESS_KEY", "")
    monkeypatch.setattr(settings, "SMS_SECRET", "")
    with pytest.raises(RuntimeError):
        ntf._send_sms_aliyun("13800138000", "123456", "register")


def test_template_selection(aliyun_settings, monkeypatch):
    assert ntf._aliyun_template_for("register") == "SMS_DEFAULT"
    assert ntf._aliyun_template_for("reset") == "SMS_DEFAULT"
    assert ntf._aliyun_template_for("verify") == "SMS_DEFAULT"
    monkeypatch.setattr(settings, "SMS_TEMPLATE_VERIFY", "SMS_VERIFY_X")
    assert ntf._aliyun_template_for("verify") == "SMS_VERIFY_X"


def test_provider_dispatch_aliyun(aliyun_settings):
    called: dict = {}

    def fake_build_opener(*handlers):
        called["hit"] = True
        return _FakeOpener(_FakeResp(_ok_body()))

    with patch("urllib.request.build_opener", side_effect=fake_build_opener):
        ntf._send_sms_provider("13800138000", "123456", "register")
    assert called.get("hit") is True


def test_provider_dispatch_unknown_falls_back(aliyun_settings, monkeypatch):
    monkeypatch.setattr(settings, "SMS_PROVIDER", "twilio")
    called: dict = {}

    def fake_build_opener(*handlers):
        called["hit"] = True
        return _FakeOpener(_FakeResp(_ok_body()))

    with patch("urllib.request.build_opener", side_effect=fake_build_opener):
        # Unknown provider -> console fallback: no network call, no exception.
        ntf._send_sms_provider("13800138000", "123456", "register")
    assert called.get("hit") is None


@pytest.mark.anyio
async def test_send_verification_code_sms_provider(aliyun_settings):
    called: dict = {}

    def fake_build_opener(*handlers):
        called["hit"] = True
        return _FakeOpener(_FakeResp(_ok_body()))

    with patch("urllib.request.build_opener", side_effect=fake_build_opener):
        # Fire-and-forget must not raise.
        await ntf.send_verification_code("sms", "13800138000", "123456", "register")
    assert called.get("hit") is True


@pytest.mark.anyio
async def test_send_verification_code_sms_console(monkeypatch):
    monkeypatch.setattr(settings, "SMS_BACKEND", "console")
    called: dict = {}

    def fake_build_opener(*handlers):
        called["hit"] = True
        return _FakeOpener(_FakeResp(_ok_body()))

    with patch("urllib.request.build_opener", side_effect=fake_build_opener):
        await ntf.send_verification_code("sms", "13800138000", "123456", "register")
    # console backend -> no network call
    assert called.get("hit") is None


# --- DYPNS (号码认证服务·短信认证) provider -----------------------------------


def test_dypns_builds_signed_request(dypns_settings):
    captured: dict = {}
    with _patch_opener(_FakeResp(_ok_body()), capture=captured):
        ntf._send_sms_dypns("13800138000", "123456", "register")

    url = captured["url"]
    assert captured["method"] == "GET"
    assert "Action=SendSmsVerifyCode" in url
    assert "PhoneNumber=13800138000" in url
    assert "SignName=GiftedSign" in url
    assert "TemplateCode=100001" in url
    # TemplateParam carries our own code AND the validity (min) as JSON.
    assert "%22code%22%3A%22123456%22" in url
    assert "%22min%22%3A10" in url
    assert "Signature=" in url
    sig = url.split("Signature=")[1].split("&")[0]
    assert len(sig) > 20  # base64(HMAC-SHA1)


def test_dypns_handles_failure(dypns_settings):
    with _patch_opener(_FakeResp(_err_body("FUNCTION_NOT_OPENED", "您未开通融合认证"))):
        with pytest.raises(RuntimeError) as exc:
            ntf._send_sms_dypns("13800138000", "123456", "register")
    assert "FUNCTION_NOT_OPENED" in str(exc.value)


def test_dypns_http_error_surfaces_body(dypns_settings):
    """An HTTP 4xx/5xx must report Aliyun's JSON body, not just the status."""
    body = json.dumps(
        {"Code": "Forbidden", "Message": "The access key is disabled.", "RequestId": "r-x"}
    ).encode("utf-8")
    http_err = urllib.error.HTTPError(
        "https://dypnsapi.aliyuncs.com/", 403, "Forbidden", {}, io.BytesIO(body)
    )
    with _patch_opener(http_err):
        with pytest.raises(RuntimeError) as exc:
            ntf._send_sms_dypns("13800138000", "123456", "register")
    msg = str(exc.value)
    assert "403" in msg
    assert "The access key is disabled." in msg


def test_dypns_missing_config_raises(monkeypatch):
    monkeypatch.setattr(settings, "SMS_ACCESS_KEY", "")
    monkeypatch.setattr(settings, "SMS_SECRET", "")
    with pytest.raises(RuntimeError):
        ntf._send_sms_dypns("13800138000", "123456", "register")


def test_dypns_requires_gifted_sign_and_template(monkeypatch):
    """DYPNS needs the gifted SignName + TemplateCode, not enterprise ones."""
    monkeypatch.setattr(settings, "SMS_ACCESS_KEY", "AKID")
    monkeypatch.setattr(settings, "SMS_SECRET", "SEC")
    monkeypatch.setattr(settings, "SMS_SIGN_NAME", "")
    monkeypatch.setattr(settings, "SMS_TEMPLATE_CODE", "")
    with pytest.raises(RuntimeError) as exc:
        ntf._send_sms_dypns("13800138000", "123456", "register")
    assert "gifted" in str(exc.value).lower()


def test_provider_dispatch_dypns(dypns_settings):
    called: dict = {}

    def fake_build_opener(*handlers):
        called["hit"] = True
        return _FakeOpener(_FakeResp(_ok_body()))

    with patch("urllib.request.build_opener", side_effect=fake_build_opener):
        ntf._send_sms_provider("13800138000", "123456", "register")
    assert called.get("hit") is True


@pytest.mark.anyio
async def test_send_verification_code_dypns(dypns_settings):
    called: dict = {}

    def fake_build_opener(*handlers):
        called["hit"] = True
        return _FakeOpener(_FakeResp(_ok_body()))

    with patch("urllib.request.build_opener", side_effect=fake_build_opener):
        await ntf.send_verification_code("sms", "13800138000", "123456", "register")
    assert called.get("hit") is True
