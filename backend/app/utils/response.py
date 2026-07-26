"""Standard response helpers for FastAPI."""

from fastapi.responses import JSONResponse


def success(data=None, message: str = "success") -> JSONResponse:
    return JSONResponse(
        content={"success": True, "message": message, "data": data}
    )


def error(message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "message": message},
    )
