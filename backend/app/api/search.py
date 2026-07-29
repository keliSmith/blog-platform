"""Search routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.database import AsyncSession, get_session
from app.dependencies import pagination_params
from app.models.article import Article
from app.schemas import ok
from app.api.articles import _serialize_article

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/articles")
async def search_articles(
    keyword: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_session),
    pagination: dict = Depends(pagination_params),
):
    """Search articles by keyword (title, content, author name).

    Returns the same paginated envelope as the article list endpoint
    ({ "items": [...], "pagination": { page, page_size, total, pages } })
    so the frontend can render results and pagination uniformly.
    """
    like = f"%{keyword}%"
    page = pagination["page"]
    page_size = pagination["page_size"]
    offset = pagination["offset"]

    base_where = (
        Article.deleted_at.is_(None),
        Article.status == "published",
        Article.title.ilike(like) | Article.content.ilike(like),
    )

    total = await session.scalar(
        select(func.count()).select_from(Article).where(*base_where)
    ) or 0

    result = await session.execute(
        select(Article)
        .options(
            joinedload(Article.author),
            joinedload(Article.category),
            joinedload(Article.tags),
        )
        .where(*base_where)
        .order_by(Article.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    articles = result.unique().scalars().all()

    items = [_serialize_article(a) for a in articles]
    pages = (total + page_size - 1) // page_size
    return ok(
        {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": pages,
            },
        }
    )
