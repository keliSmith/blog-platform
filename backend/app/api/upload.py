"""File upload routes."""

import os
from io import BytesIO
from uuid import uuid4

from fastapi import APIRouter, Depends, UploadFile
from PIL import Image

from app.config import settings
from app.database import AsyncSession, get_session
from app.dependencies import CurrentUser
from app.models.user import User
from app.schemas import fail, ok

router = APIRouter(prefix="/api/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _check_image(file_bytes: bytes) -> bool:
    try:
        img = Image.open(BytesIO(file_bytes))
        img.verify()
        return True
    except Exception:
        return False


def _save_compressed(file_bytes: bytes, save_path: str, size: tuple[int, int]) -> None:
    img: Image.Image = Image.open(BytesIO(file_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail(size)
    img.save(save_path, "WEBP", quality=85)


# ---------------------------------------------------------------------------
# POST /api/upload/avatar
# ---------------------------------------------------------------------------


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if not file.filename or not _allowed_file(file.filename):
        return fail("文件格式不支持")

    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE:
        return fail("文件过大")

    if not _check_image(file_bytes):
        return fail("不是有效图片")

    filename = f"{uuid4().hex}.webp"
    upload_dir = os.path.join(settings.UPLOAD_FOLDER, "avatar")
    os.makedirs(upload_dir, exist_ok=True)
    upload_path = os.path.join(upload_dir, filename)
    _save_compressed(file_bytes, upload_path, (800, 800))

    url = f"/uploads/avatar/{filename}"

    # Update user avatar
    user = await session.get(User, user_id)
    if user:
        user.avatar = url

    await session.flush()
    return ok({"url": url}, message="头像上传成功")


# ---------------------------------------------------------------------------
# POST /api/upload/cover
# ---------------------------------------------------------------------------


@router.post("/cover")
async def upload_cover(
    file: UploadFile,
    _user_id: CurrentUser,
    _session: AsyncSession = Depends(get_session),
):
    if not file.filename or not _allowed_file(file.filename):
        return fail("文件格式不支持")

    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE:
        return fail("文件过大")

    if not _check_image(file_bytes):
        return fail("不是有效图片")

    filename = f"{uuid4().hex}.webp"
    upload_dir = os.path.join(settings.UPLOAD_FOLDER, "cover")
    os.makedirs(upload_dir, exist_ok=True)
    upload_path = os.path.join(upload_dir, filename)
    _save_compressed(file_bytes, upload_path, (1200, 1200))

    url = f"/uploads/cover/{filename}"
    return ok({"url": url}, message="封面上传成功")


# ---------------------------------------------------------------------------
# POST /api/upload/image
# ---------------------------------------------------------------------------


@router.post("/image")
async def upload_image(
    file: UploadFile,
    _user_id: CurrentUser,
    _session: AsyncSession = Depends(get_session),
):
    """Inline image upload for article content."""
    if not file.filename:
        return fail("文件为空")
    if not _allowed_file(file.filename):
        return fail("文件格式不支持")

    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE:
        return fail("文件过大")

    if not _check_image(file_bytes):
        return fail("不是有效图片")

    filename = f"{uuid4().hex}.webp"
    upload_dir = os.path.join(settings.UPLOAD_FOLDER, "image")
    os.makedirs(upload_dir, exist_ok=True)
    upload_path = os.path.join(upload_dir, filename)
    _save_compressed(file_bytes, upload_path, (1600, 1600))

    url = f"/uploads/image/{filename}"
    return ok({"url": url}, message="图片上传成功")
