"""SQLAlchemy 2.0 async model — VerificationCode.

Stores short-lived verification codes used for:
- email / SMS verification during registration (`purpose="register"`)
- password reset / account recovery (`purpose="reset"`)

Codes live in the database (not just in-memory) so they survive across
requests and work with multiple workers sharing one DB. Each code is
single-use and expires after ``settings.VERIFICATION_CODE_TTL_MINUTES``.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Email address or phone number the code was sent to.
    target: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    # "email" or "sms"
    channel: Mapped[str] = mapped_column(String(10), nullable=False)
    # "register" or "reset"
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    # The 6-digit code (plaintext; short-lived, single-use).
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    # Number of failed verification attempts for this code.
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:
        return f"<VerificationCode {self.target} {self.channel} {self.purpose}>"
