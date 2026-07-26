"""Auth-related Pydantic schemas."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    token: str


class UserBrief(BaseModel):
    id: int
    username: str
    email: str
    avatar: str | None = None
    role: str = "user"
    created_at: str | None = None

    model_config = {"from_attributes": True}
