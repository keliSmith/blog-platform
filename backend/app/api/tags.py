"""Tag CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.database import AsyncSession, get_session
from app.dependencies import CurrentUser, pagination_params
from app.models.article import Article, article_tags
from app.models.tag import Tag
from app.schemas import fail, ok

router = APIRouter(prefix="/api/tags", tags=["tags"])


def _slugify(text: str) -> str:
    import re
    if not text:
        return ""
    base = str(text).lower()
    base = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", base)
    return base.strip("-")


class CreateTagRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str | None = None


class UpdateTagRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class ReorderTagRequest(BaseModel):
    ordered_ids: list[int] = Field(..., min_length=1, description="标签 ID，按期望显示顺序排列")


# ---------------------------------------------------------------------------
# POST /api/tags
# ---------------------------------------------------------------------------


@router.post("")
async def create_tag(
    body: CreateTagRequest,
    _user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    slug = _slugify(body.name)
    exists = await session.scalar(select(Tag.id).where(Tag.slug == slug))
    if exists is not None:
        return fail("标签已存在")

    tag = Tag(name=body.name, slug=slug, description=body.description)
    session.add(tag)
    await session.flush()

    return ok({
        "id": tag.id,
        "name": tag.name,
        "slug": tag.slug,
        "description": tag.description,
    }, message="标签创建成功")


# ---------------------------------------------------------------------------
# GET /api/tags
# ---------------------------------------------------------------------------


@router.get("")
async def list_tags(
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Tag).order_by(Tag.sort_order, Tag.created_at.desc())
    )
    tags = result.scalars().all()
    items = [
        {
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "description": t.description,
            "sort_order": t.sort_order,
        }
        for t in tags
    ]
    return ok(items)


# ---------------------------------------------------------------------------
# PUT /api/tags/reorder
# ---------------------------------------------------------------------------


@router.put("/reorder")
async def reorder_tags(
    body: ReorderTagRequest,
    _user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Persist a new display order for tags.

    `ordered_ids` lists every tag id in the desired display order; each tag's
    `sort_order` is set to its position index. Unknown / missing ids are ignored
    so the call stays idempotent even if the list was edited concurrently.
    """
    result = await session.execute(select(Tag).where(Tag.id.in_(body.ordered_ids)))
    tags = {t.id: t for t in result.scalars().all()}
    for index, tag_id in enumerate(body.ordered_ids):
        tag = tags.get(tag_id)
        if tag is not None:
            tag.sort_order = index
    await session.flush()
    return ok(message="标签排序已更新")


# ---------------------------------------------------------------------------
# GET /api/tags/{slug}
# ---------------------------------------------------------------------------


@router.get("/{slug:str}")
async def get_tag(
    slug: str,
    pagination: dict = Depends(pagination_params),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Tag).where(Tag.slug == slug))
    tag = result.scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="标签不存在")

    page = pagination["page"]
    page_size = pagination["page_size"]
    offset = pagination["offset"]

    total = await session.scalar(
        select(func.count(Article.id))
        .select_from(Article)
        .join(article_tags)
        .where(
            article_tags.c.tag_id == tag.id,
            Article.deleted_at.is_(None),
            Article.status == "published",
        )
    ) or 0

    articles_result = await session.execute(
        select(Article)
        .options(
            joinedload(Article.author),
            joinedload(Article.category),
            joinedload(Article.tags),
        )
        .join(article_tags)
        .where(
            article_tags.c.tag_id == tag.id,
            Article.deleted_at.is_(None),
            Article.status == "published",
        )
        .order_by(Article.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    articles = articles_result.unique().scalars().all()

    from app.api.articles import _serialize_article

    items = [_serialize_article(a) for a in articles]
    pages = (total + page_size - 1) // page_size

    return ok({
        "id": tag.id,
        "name": tag.name,
        "slug": tag.slug,
        "description": tag.description,
        "articles": {
            "items": items,
            "pagination": {"page": page, "page_size": page_size, "total": total, "pages": pages},
        },
    })


# ---------------------------------------------------------------------------
# PUT /api/tags/{id}
# ---------------------------------------------------------------------------


@router.put("/{tag_id:int}")
async def update_tag(
    tag_id: int,
    body: UpdateTagRequest,
    _user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    tag = await session.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="标签不存在")

    if body.name is not None:
        tag.name = body.name
        tag.slug = _slugify(body.name)
    if body.description is not None:
        tag.description = body.description

    await session.flush()
    return ok({
        "id": tag.id,
        "name": tag.name,
        "slug": tag.slug,
        "description": tag.description,
    }, message="标签更新成功")


# ---------------------------------------------------------------------------
# DELETE /api/tags/{id}
# ---------------------------------------------------------------------------


@router.delete("/{tag_id:int}")
async def delete_tag(
    tag_id: int,
    _user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    tag = await session.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="标签不存在")

    # Check if tag is in use
    count = await session.scalar(
        select(func.count()).select_from(article_tags).where(article_tags.c.tag_id == tag_id)
    ) or 0

    if count > 0:
        return fail("该标签被文章引用, 无法删除")

    await session.delete(tag)
    await session.flush()
    return ok(message="标签删除成功")
