"""Favorite/unfavorite routes."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.database import AsyncSession, get_session
from app.dependencies import CurrentUser, OptionalUser, deny_if_unverified
from app.models.interaction import ArticleFavorite
from app.schemas import ok

router = APIRouter(prefix="/api", tags=["favorites"])


# ---------------------------------------------------------------------------
# POST /api/articles/{article_id}/favorite
# ---------------------------------------------------------------------------


@router.post("/articles/{article_id:int}/favorite")
async def favorite_article(
    article_id: int,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await deny_if_unverified(user_id, session)
    exists = await session.scalar(
        select(ArticleFavorite.id).where(
            ArticleFavorite.article_id == article_id,
            ArticleFavorite.user_id == user_id,
        )
    )
    if exists is not None:
        return ok(message="已收藏")

    fav = ArticleFavorite(article_id=article_id, user_id=user_id)
    session.add(fav)
    await session.flush()
    return ok(message="收藏成功")


# ---------------------------------------------------------------------------
# DELETE /api/articles/{article_id}/favorite
# ---------------------------------------------------------------------------


@router.delete("/articles/{article_id:int}/favorite")
async def unfavorite_article(
    article_id: int,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ArticleFavorite).where(
            ArticleFavorite.article_id == article_id,
            ArticleFavorite.user_id == user_id,
        )
    )
    fav = result.scalar_one_or_none()
    if fav is None:
        return ok(message="未收藏")

    await session.delete(fav)
    await session.flush()
    return ok(message="取消收藏成功")


# ---------------------------------------------------------------------------
# GET /api/articles/{article_id}/favorite
# ---------------------------------------------------------------------------


@router.get("/articles/{article_id:int}/favorite")
async def get_favorite_status(
    article_id: int,
    identity: OptionalUser,
    session: AsyncSession = Depends(get_session),
):
    # Public: anyone (including anonymous visitors) may check an article's
    # favorite count. Only logged-in users get their personal favorite state,
    # so viewing a published article never requires authentication.
    favorite_count = await session.scalar(
        select(func.count(ArticleFavorite.id)).where(
            ArticleFavorite.article_id == article_id
        )
    ) or 0

    favorited = False
    if identity:
        favorited = await session.scalar(
            select(ArticleFavorite.id).where(
                ArticleFavorite.article_id == article_id,
                ArticleFavorite.user_id == identity,
            )
        ) is not None

    return ok({"favorited": favorited, "favorites": favorite_count})
