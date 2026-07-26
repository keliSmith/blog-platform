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
