"""Category CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.database import AsyncSession, get_session
from app.dependencies import CurrentUser, pagination_params
from app.models.article import Article
from app.models.category import Category
from app.schemas import fail, ok

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _slugify(text: str) -> str:
    import re
    if not text:
        return ""
    base = str(text).lower()
    base = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", base)
    return base.strip("-")


class CreateCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None


class UpdateCategoryRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class ReorderCategoryRequest(BaseModel):
    ordered_ids: list[int] = Field(..., min_length=1, description="分类 ID，按期望显示顺序排列")


# ---------------------------------------------------------------------------
# POST /api/categories
# ---------------------------------------------------------------------------


@router.post("")
async def create_category(
    body: CreateCategoryRequest,
    _user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    slug = _slugify(body.name)
    exists = await session.scalar(
        select(Category.id).where(Category.slug == slug)
    )
    if exists is not None:
        return fail("分类已存在")

    cat = Category(name=body.name, slug=slug, description=body.description)
    session.add(cat)
    await session.flush()

    return ok({
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug,
        "description": cat.description,
    }, message="分类创建成功")


# ---------------------------------------------------------------------------
# GET /api/categories
# ---------------------------------------------------------------------------


@router.get("")
async def list_categories(
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Category).order_by(Category.sort_order, Category.created_at.desc())
    )
    categories = result.scalars().all()
    items = [
        {
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "description": c.description,
            "sort_order": c.sort_order,
        }
        for c in categories
    ]
    return ok(items)


# ---------------------------------------------------------------------------
# PUT /api/categories/reorder
# ---------------------------------------------------------------------------


@router.put("/reorder")
async def reorder_categories(
    body: ReorderCategoryRequest,
    _user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Persist a new display order for categories.

    `ordered_ids` lists every category id in the desired display order; each
    category's `sort_order` is set to its position index. Unknown / missing ids
    are ignored so the call stays idempotent even if the list was edited
    concurrently.
    """
    result = await session.execute(
        select(Category).where(Category.id.in_(body.ordered_ids))
    )
    categories = {c.id: c for c in result.scalars().all()}
    for index, category_id in enumerate(body.ordered_ids):
        category = categories.get(category_id)
        if category is not None:
            category.sort_order = index
    await session.flush()
    return ok(message="分类排序已更新")


# ---------------------------------------------------------------------------
# GET /api/categories/{slug}
# ---------------------------------------------------------------------------


@router.get("/{slug:str}")
async def get_category(
    slug: str,
    pagination: dict = Depends(pagination_params),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Category).where(Category.slug == slug)
    )
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")

    page = pagination["page"]
    page_size = pagination["page_size"]
    offset = pagination["offset"]

    total = await session.scalar(
        select(func.count(Article.id)).where(
            Article.category_id == category.id,
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
        .where(
            Article.category_id == category.id,
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
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "articles": {
            "items": items,
            "pagination": {"page": page, "page_size": page_size, "total": total, "pages": pages},
        },
    })


# ---------------------------------------------------------------------------
# PUT /api/categories/{id}
# ---------------------------------------------------------------------------


@router.put("/{category_id}")
async def update_category(
    category_id: int,
    body: UpdateCategoryRequest,
    _user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    cat = await session.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")

    if body.name is not None:
        cat.name = body.name
        cat.slug = _slugify(body.name)
    if body.description is not None:
        cat.description = body.description

    await session.flush()
    return ok({
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug,
        "description": cat.description,
    }, message="分类更新成功")


# ---------------------------------------------------------------------------
# DELETE /api/categories/{id}
# ---------------------------------------------------------------------------


@router.delete("/{category_id}")
async def delete_category(
    category_id: int,
    _user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    cat = await session.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")

    # Check for articles
    count = await session.scalar(
        select(func.count(Article.id)).where(
            Article.category_id == category_id, Article.deleted_at.is_(None)
        )
    ) or 0

    if count > 0:
        return fail("该分类下有文章, 无法删除")

    await session.delete(cat)
    await session.flush()
    return ok(message="分类删除成功")
