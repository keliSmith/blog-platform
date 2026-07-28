"""Like/unlike routes."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.database import AsyncSession, get_session
from app.dependencies import CurrentUser, OptionalUser, deny_if_unverified
from app.models.interaction import ArticleLike
from app.schemas import ok

router = APIRouter(prefix="/api", tags=["likes"])


# ---------------------------------------------------------------------------
# POST /api/articles/{article_id}/like
# ---------------------------------------------------------------------------


@router.post("/articles/{article_id:int}/like")
async def like_article(
    article_id: int,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await deny_if_unverified(user_id, session)
    # Check if already liked
    exists = await session.scalar(
        select(ArticleLike.id).where(
            ArticleLike.article_id == article_id,
            ArticleLike.user_id == user_id,
        )
    )
    if exists is not None:
        return ok(message="已点赞")

    like = ArticleLike(article_id=article_id, user_id=user_id)
    session.add(like)
    await session.flush()

    count = await session.scalar(
        select(func.count(ArticleLike.id)).where(ArticleLike.article_id == article_id)
    ) or 0

    return ok({"liked": True, "like_count": count}, message="点赞成功")


# ---------------------------------------------------------------------------
# DELETE /api/articles/{article_id}/like
# ---------------------------------------------------------------------------


@router.delete("/articles/{article_id:int}/like")
async def unlike_article(
    article_id: int,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ArticleLike).where(
            ArticleLike.article_id == article_id,
            ArticleLike.user_id == user_id,
        )
    )
    like = result.scalar_one_or_none()
    if like is None:
        return ok(message="未点赞")

    await session.delete(like)
    await session.flush()

    count = await session.scalar(
        select(func.count(ArticleLike.id)).where(ArticleLike.article_id == article_id)
    ) or 0

    return ok({"liked": False, "like_count": count}, message="取消点赞成功")


# ---------------------------------------------------------------------------
# GET /api/articles/{article_id}/like
# ---------------------------------------------------------------------------


@router.get("/articles/{article_id:int}/like")
async def get_like_status(
    article_id: int,
    identity: OptionalUser,
    session: AsyncSession = Depends(get_session),
):
    count = await session.scalar(
        select(func.count(ArticleLike.id)).where(ArticleLike.article_id == article_id)
    ) or 0

    liked = False
    if identity:
        liked = await session.scalar(
            select(ArticleLike.id).where(
                ArticleLike.article_id == article_id,
                ArticleLike.user_id == identity,
            )
        ) is not None

    return ok({"liked": liked, "like_count": count})
