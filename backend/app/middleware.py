"""FastAPI middleware: CORS, URL rewriting, JSON charset."""

import json as _json

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings


class UploadURLRewriterMiddleware(BaseHTTPMiddleware):
    """Rewrite relative /uploads/... paths to absolute URLs in JSON responses."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response

        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        try:
            data = _json.loads(body)
        except Exception:
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
            )

        if isinstance(data, (dict, list)):
            # Resolve base URL from config or request
            base = (settings.UPLOAD_BASE_URL or "").strip()
            base = str(request.base_url).rstrip("/") if not base else base.rstrip("/")

            def _rewrite(obj: object) -> None:
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        if isinstance(v, str) and v.startswith("/uploads/"):
                            obj[k] = f"{base}{v}"
                        elif isinstance(v, (dict, list)):
                            _rewrite(v)
                elif isinstance(obj, list):
                    for i, v in enumerate(obj):
                        if isinstance(v, str) and v.startswith("/uploads/"):
                            obj[i] = f"{base}{v}"
                        elif isinstance(v, (dict, list)):
                            _rewrite(v)

            _rewrite(data)

        new_body = _json.dumps(data, ensure_ascii=False).encode("utf-8")
        return Response(
            content=new_body,
            status_code=response.status_code,
            headers={
                **dict(response.headers),
                "content-type": "application/json; charset=utf-8",
                "content-length": str(len(new_body)),
            },
        )
