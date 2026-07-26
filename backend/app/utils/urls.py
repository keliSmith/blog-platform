"""Helpers for turning stored (relative) upload paths into absolute URLs."""

from app.config import settings


def public_base_url(request_base_url: str = "") -> str:
    """Return the public base URL used to prefix uploaded assets."""
    configured = (settings.UPLOAD_BASE_URL or "").strip()
    if configured:
        return configured.rstrip("/")
    return request_base_url.rstrip("/")


def to_public_url(path: str | None, base_url: str = "") -> str | None:
    """Convert a stored upload path to an absolute URL."""
    if not path:
        return path
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{public_base_url(base_url)}{path}"


def rewrite_relative_upload_urls(data, base_url: str = ""):
    """Recursively rewrite /uploads/... paths to absolute URLs (mutates in place)."""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, str) and value.startswith("/uploads/"):
                data[key] = to_public_url(value, base_url)
            elif isinstance(value, (dict, list)):
                rewrite_relative_upload_urls(value, base_url)
    elif isinstance(data, list):
        for i, value in enumerate(data):
            if isinstance(value, str) and value.startswith("/uploads/"):
                data[i] = to_public_url(value, base_url)
            elif isinstance(value, (dict, list)):
                rewrite_relative_upload_urls(value, base_url)
    return data
