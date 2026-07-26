"""Auth-related Pydantic schemas."""

import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

_PHONE_RE = re.compile(r"^1[3-9]\d{9}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_phone(value: str) -> str:
    if not _PHONE_RE.match(value):
        raise ValueError("手机号格式不正确")
    return value


def _validate_email_str(value: str) -> str:
    if not _EMAIL_RE.match(value):
        raise ValueError("邮箱格式不正确")
    return value


class RegisterRequest(BaseModel):
    """Register a new user.

    Exactly ONE verification channel must be supplied:
      - email + email_code   (email-verified registration)
      - phone + phone_code   (SMS-verified registration)
    """

    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    email: EmailStr | None = None
    phone: str | None = None
    email_code: str | None = Field(None, min_length=4, max_length=10)
    phone_code: str | None = Field(None, min_length=4, max_length=10)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v is not None:
            return _validate_phone(v)
        return v

    @model_validator(mode="after")
    def _exactly_one_channel(self) -> "RegisterRequest":
        has_email = bool(self.email and self.email_code)
        has_phone = bool(self.phone and self.phone_code)
        if not has_email and not has_phone:
            raise ValueError("请通过邮箱验证码或手机验证码完成注册")
        if has_email and has_phone:
            raise ValueError("请仅使用邮箱或手机号其中一种方式注册")
        return self


class LoginRequest(BaseModel):
    # Accepts a username, email, or phone number.
    username: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=1, max_length=128)


class SendCodeRequest(BaseModel):
    target: str = Field(..., min_length=1, max_length=120)
    channel: Literal["email", "sms"]
    purpose: Literal["register", "reset"]

    @model_validator(mode="after")
    def _target_matches_channel(self) -> "SendCodeRequest":
        if self.channel == "email":
            _validate_email_str(self.target)
        else:
            _validate_phone(self.target)
        return self


class ResetPasswordRequest(BaseModel):
    target: str = Field(..., min_length=1, max_length=120)
    channel: Literal["email", "sms"]
    code: str = Field(..., min_length=4, max_length=10)
    new_password: str = Field(..., min_length=6, max_length=128)

    @model_validator(mode="after")
    def _target_matches_channel(self) -> "ResetPasswordRequest":
        if self.channel == "email":
            _validate_email_str(self.target)
        else:
            _validate_phone(self.target)
        return self


class TokenResponse(BaseModel):
    token: str


class UserBrief(BaseModel):
    id: int
    username: str
    email: str | None = None
    phone: str | None = None
    avatar: str | None = None
    role: str = "user"
    email_verified: bool = False
    phone_verified: bool = False
    created_at: str | None = None

    model_config = {"from_attributes": True}
