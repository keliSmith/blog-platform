"""Admin routes: comment management and dashboard statistics."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.database import AsyncSession, get_session
from app.dependencies import CurrentAdmin
from app.models.article import Article
from app.models.comment import Comment
from app.models.interaction import ArticleFavorite, ArticleLike, ArticleView
from app.models.user import User
from app.schemas import fail, ok

router = APIRouter(tags=["admin"])


# ---------------------------------------------------------------------------
# GET /api/admin/stats — Dashboard
# ---------------------------------------------------------------------------


@router.get("/api/admin/stats")
async def admin_dashboard(
    _admin_id: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
):
    total_users = await session.scalar(select(func.count(User.id))) or 0
    total_articles = await session.scalar(
        select(func.count(Article.id)).where(Article.deleted_at.is_(None))
    ) or 0
    total_views = await session.scalar(
        select(func.coalesce(func.sum(Article.views), 0)).where(Article.deleted_at.is_(None))
    ) or 0
    total_comments = await session.scalar(
        select(func.count(Comment.id)).where(Comment.deleted_at.is_(None))
    ) or 0
    total_likes = await session.scalar(select(func.count(ArticleLike.id))) or 0
    total_favorites = await session.scalar(select(func.count(ArticleFavorite.id))) or 0
    today = date.today()
    today_views = await session.scalar(
        select(func.count(ArticleView.id)).where(ArticleView.created_at >= today)
    ) or 0

    return ok({
        "total_users": total_users,
        "total_articles": total_articles,
        "total_views": total_views,
        "total_comments": total_comments,
        "total_likes": total_likes,
        "total_favorites": total_favorites,
        "today_views": today_views,
    })


# ---------------------------------------------------------------------------
# GET /api/admin/comments — List all comments
# ---------------------------------------------------------------------------


@router.get("/api/admin/comments")
async def admin_comments_list(
    _admin_id: CurrentAdmin,
    status_filter: str | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Comment).where(Comment.deleted_at.is_(None))

    if status_filter:
        stmt = stmt.where(Comment.status == status_filter)

    result = await session.execute(
        stmt.options(
            joinedload(Comment.user),
            joinedload(Comment.article),
        ).order_by(Comment.created_at.desc())
    )
    comments = result.unique().scalars().all()

    items = [
        {
            "id": c.id,
            "content": c.content,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "article": {
                "id": c.article.id if c.article else None,
                "title": c.article.title if c.article else None,
            },
            "user": {
                "id": c.user.id if c.user else None,
                "username": c.user.username if c.user else None,
            },
        }
        for c in comments
    ]
    return ok(items)


# ---------------------------------------------------------------------------
# PUT /api/admin/comments/{id}/status — Update comment status
# ---------------------------------------------------------------------------


class UpdateCommentStatusRequest(BaseModel):
    status: str


@router.put("/api/admin/comments/{comment_id}/status")
async def update_comment_status(
    comment_id: int,
    body: UpdateCommentStatusRequest,
    _admin_id: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
):
    if body.status not in ("pending", "approved", "rejected"):
        return fail("无效的评论状态")

    result = await session.execute(
        select(Comment).where(Comment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="评论不存在")

    comment.status = body.status
    await session.flush()
    return ok(message="评论状态更新成功")
