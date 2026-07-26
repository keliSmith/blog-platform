"""Statistics routes."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.database import AsyncSession, get_session
from app.models.article import Article
from app.models.interaction import ArticleView
from app.schemas import ok

router = APIRouter(prefix="/api/statistics", tags=["statistics"])


@router.get("/hot/articles")
async def hot_articles(
    session: AsyncSession = Depends(get_session),
):
    """Top articles by total views."""
    result = await session.execute(
        select(Article)
        .where(Article.deleted_at.is_(None), Article.status == "published")
        .order_by(Article.views.desc())
        .limit(10)
    )
    articles = result.scalars().all()

    items = [
        {
            "id": a.id,
            "title": a.title,
            "slug": a.slug,
            "views": a.views,
            "summary": a.summary,
            "cover_image": a.cover_image,
        }
        for a in articles
    ]
    return ok(items)


@router.get("/hot/today")
async def hot_today(
    session: AsyncSession = Depends(get_session),
):
    """Today's most viewed articles."""
    today = date.today()
    result = await session.execute(
        select(
            Article.id,
            Article.title,
            Article.slug,
            Article.summary,
            Article.cover_image,
            Article.views,
            func.count(ArticleView.id).label("today_views"),
        )
        .outerjoin(
            ArticleView,
            (Article.id == ArticleView.article_id) & (ArticleView.created_at >= today),
        )
        .where(
            Article.deleted_at.is_(None),
            Article.status == "published",
        )
        .group_by(Article.id)
        .order_by(func.count(ArticleView.id).desc())
        .limit(10)
    )
    rows = result.mappings().all()
    items = [
        {
            "id": row["id"],
            "title": row["title"],
            "slug": row["slug"],
            "summary": row["summary"],
            "cover_image": row["cover_image"],
            "views": row["views"],
            "today_views": row["today_views"],
        }
        for row in rows
    ]
    return ok(items)


@router.get("/hot/week")
async def hot_week(
    session: AsyncSession = Depends(get_session),
):
    """This week's most viewed articles."""
    week_ago = date.today() - timedelta(days=7)
    result = await session.execute(
        select(
            Article.id,
            Article.title,
            Article.slug,
            Article.summary,
            Article.cover_image,
            Article.views,
            func.count(ArticleView.id).label("week_views"),
        )
        .outerjoin(
            ArticleView,
            (Article.id == ArticleView.article_id) & (ArticleView.created_at >= week_ago),
        )
        .where(
            Article.deleted_at.is_(None),
            Article.status == "published",
        )
        .group_by(Article.id)
        .order_by(func.count(ArticleView.id).desc())
        .limit(10)
    )
    rows = result.mappings().all()
    items = [
        {
            "id": row["id"],
            "title": row["title"],
            "slug": row["slug"],
            "summary": row["summary"],
            "cover_image": row["cover_image"],
            "views": row["views"],
            "week_views": row["week_views"],
        }
        for row in rows
    ]
    return ok(items)
