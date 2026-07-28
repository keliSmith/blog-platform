"""FastAPI exception handlers returning the standard ApiResponse envelope."""

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class UnverifiedError(StarletteHTTPException):
    """403 raised when an unverified account hits a trust-restricted action.

    Carries ``data={"need_verify": True}`` so the frontend can show a guided
    modal pointing the user to the verification page instead of a plain toast.
    """

    def __init__(
        self,
        message: str = "请先验证邮箱或手机",
        data: dict | None = None,
    ) -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=message)
        self.data: dict = data if data is not None else {"need_verify": True}


async def http_exception_handler(
    _request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    content = {
        "success": False,
        "message": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
    }
    # Let callers attach extra structured data (e.g. need_verify) to the body.
    extra = getattr(exc, "data", None)
    if extra:
        content["data"] = extra
    return JSONResponse(status_code=exc.status_code, content=content)


async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Extract the first error message for a user-friendly response
    messages = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        messages.append(f"{field}: {error['msg']}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "; ".join(messages),
        },
    )
