"""Common Pydantic schemas: response envelope and pagination."""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "success"
    data: T | None = None


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    pagination: PaginationMeta


def ok(data: Any = None, message: str = "success") -> dict:
    """Build a success response dict (for endpoints returning dict)."""
    return {"success": True, "message": message, "data": data}


def fail(message: str) -> dict:
    """Build an error response dict."""
    return {"success": False, "message": message}
