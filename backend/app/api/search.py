"""Search routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.database import AsyncSession, get_session
from app.models.article import Article
from app.schemas import ok

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/articles")
async def search_articles(
    keyword: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_session),
):
    """Search articles by keyword (title, content, author name)."""
    like = f"%{keyword}%"

    result = await session.execute(
        select(Article)
        .options(joinedload(Article.author))
        .where(
            Article.deleted_at.is_(None),
            Article.status == "published",
            Article.title.ilike(like) | Article.content.ilike(like),
        )
        .order_by(Article.created_at.desc())
    )
    articles = result.unique().scalars().all()

    items = [
        {
            "id": a.id,
            "title": a.title,
            "slug": a.slug,
            "summary": a.summary,
            "cover_image": a.cover_image,
            "status": a.status,
            "views": a.views,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "author_id": a.author_id,
            "author_name": a.author.username if a.author else None,
        }
        for a in articles
    ]
    return ok(items)
