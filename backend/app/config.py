"""Application configuration via Pydantic Settings."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings

_BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "Blog API"
    APP_VERSION: str = "v1"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = "blog-secret-key"

    # --- Database ---
    # Set DATABASE_URL to override the auto-generated URI.
    # Defaults to SQLite for zero-config local development.
    # For MySQL: mysql+pymysql://user:pass@host:3306/dbname?charset=utf8mb4
    DATABASE_URL: str = ""
    MYSQL_HOST: str = "127.0.0.1"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "blog_user"
    MYSQL_PASSWORD: str = "blog_password"
    MYSQL_DATABASE: str = "blog"
    SQLALCHEMY_DATABASE_URI: str = ""

    # --- JWT ---
    JWT_SECRET_KEY: str = "blog-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # --- Upload ---
    UPLOAD_FOLDER: str = "uploads"
    MAX_UPLOAD_SIZE: int = 5 * 1024 * 1024  # 5MB
    ALLOWED_IMAGE_EXTENSIONS: set[str] = {"jpg", "jpeg", "png", "gif", "webp"}
    UPLOAD_BASE_URL: str = ""

    # --- Verification codes (email / SMS) ---
    # Time-to-live of a verification code, in minutes.
    VERIFICATION_CODE_TTL_MINUTES: int = 10
    # Minimum seconds between two code sends to the same target/channel/purpose.
    VERIFICATION_CODE_RESEND_SECONDS: int = 60
    # Max wrong-attempts before a code is invalidated (defense against brute force).
    VERIFICATION_CODE_MAX_ATTEMPTS: int = 5
    # When True the send-code response echoes the code in `data.dev_code`.
    # ONLY for local development (no real SMS/email provider wired up) so the
    # UI flow can be tested without reading server logs. Production defaults
    # to False. Use the `console` notification backends to still see codes.
    EXPOSE_DEV_CODE: bool = False
    # Grace period (days) after registration during which an unverified
    # account may still comment / favorite / like. After this window,
    # unverified accounts are blocked from those trust-sensitive actions
    # until they verify an email or phone number (see dependencies.deny_if_unverified).
    VERIFICATION_GRACE_DAYS: int = 7

    # --- Email notification backend ---
    # "console"  -> log the code to the server console (default, no deps).
    # "smtp"     -> send a real email via SMTP (uses stdlib smtplib).
    EMAIL_BACKEND: str = "console"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@blog.local"
    SMTP_USE_TLS: bool = True  # True -> SMTP_SSL (465); False -> STARTTLS (587)

    # --- SMS notification backend ---
    # "console" -> log the code to the server console (default, no deps).
    # "provider" -> send real SMS via the provider named in SMS_PROVIDER.
    #   Implemented: "aliyun" (DysmsAPI, 企业签名/模板) and "dypns"
    #   (号码认证服务·短信认证 SendSmsVerifyCode, 个人免签名/模板). 两者纯 stdlib。
    SMS_BACKEND: str = "console"
    SMS_PROVIDER: str = ""  # e.g. "aliyun", "tencent", "twilio"
    SMS_ACCESS_KEY: str = ""  # Aliyun AccessKeyId
    SMS_SECRET: str = ""  # Aliyun AccessKeySecret
    SMS_SIGN_NAME: str = ""  # 已审核通过的短信签名
    SMS_REGION_ID: str = "cn-hangzhou"  # Aliyun SMS endpoint region
    # Template codes. SMS_TEMPLATE_CODE is the shared default; per-purpose
    # overrides are recommended because Aliyun templates are purpose-specific.
    SMS_TEMPLATE_CODE: str = ""
    SMS_TEMPLATE_REGISTER: str = ""
    SMS_TEMPLATE_RESET: str = ""
    SMS_TEMPLATE_VERIFY: str = ""
    # Variable name injected into the template (Aliyun TemplateParam is JSON).
    # Most templates use {"code": "123456"} -> leave as "code".
    SMS_TEMPLATE_PARAM_KEY: str = "code"
    # Network timeout (seconds) for the Aliyun SendSms HTTP call.
    SMS_TIMEOUT: int = 10
    # By default the SendSms call connects DIRECTLY to dysmsapi.aliyuncs.com
    # and ignores HTTP(S)_PROXY env vars. This avoids 403s from localhost MITM
    # proxies (Fiddler/Charles/mitmproxy/VPN tools) that can't forward the
    # Aliyun endpoint. Set to True only if outbound MUST go through a corporate
    # proxy.
    SMS_USE_PROXY: bool = False

    model_config = {
        "env_file": str(_BASE_DIR / ".env"),
        "case_sensitive": True,
        "extra": "allow",
    }

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        if not self.SQLALCHEMY_DATABASE_URI:
            if self.DATABASE_URL:
                self.SQLALCHEMY_DATABASE_URI = self.DATABASE_URL
            else:
                self.SQLALCHEMY_DATABASE_URI = self._default_database_uri()

    def _default_database_uri(self) -> str:
        """Build the default database URI for the current environment."""
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            f"?charset=utf8mb4"
        )


class DevelopmentSettings(Settings):
    """Local development — uses SQLite by default for zero-config startup."""

    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"
    # Convenience for local UI testing without a real mail/SMS gateway:
    # the send-code endpoint will echo the code in its response.
    EXPOSE_DEV_CODE: bool = True

    def _default_database_uri(self) -> str:
        return "sqlite+aiosqlite:///./dev.db"


class TestingSettings(Settings):
    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        # Use file-based SQLite for testing — no MySQL needed
        self.SQLALCHEMY_DATABASE_URI = "sqlite+aiosqlite:///./test.db"


class ProductionSettings(Settings):
    LOG_LEVEL: str = "WARNING"


_config_map: dict[str, type[Settings]] = {
    "development": DevelopmentSettings,
    "testing": TestingSettings,
    "production": ProductionSettings,
}


def load_settings(env: str | None = None) -> Settings:
    name = env or os.getenv("APP_ENV", "development") or "development"
    cls = _config_map.get(name, DevelopmentSettings)
    return cls()


settings = load_settings()
