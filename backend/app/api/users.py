"""User routes: profile, password, my articles/comments/favorites."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.database import AsyncSession, get_session
from app.dependencies import CurrentUser, hash_password, pagination_params, verify_password
from app.models.article import Article
from app.models.comment import Comment
from app.models.interaction import ArticleFavorite
from app.models.user import User
from app.schemas import fail, ok

router = APIRouter(prefix="/api", tags=["users"])


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar": user.avatar,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


# ---------------------------------------------------------------------------
# GET /api/me
# ---------------------------------------------------------------------------


@router.get("/me")
async def get_me(
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return ok(_serialize_user(user))


# ---------------------------------------------------------------------------
# GET /api/user/profile
# ---------------------------------------------------------------------------


@router.get("/user/profile")
async def get_profile(
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return fail("用户不存在")

    article_count = await session.scalar(
        select(func.count(Article.id)).where(
            Article.author_id == user_id, Article.deleted_at.is_(None)
        )
    )
    comment_count = await session.scalar(
        select(func.count(Comment.id)).where(
            Comment.user_id == user_id, Comment.deleted_at.is_(None)
        )
    )
    favorite_count = await session.scalar(
        select(func.count(ArticleFavorite.id)).where(ArticleFavorite.user_id == user_id)
    )

    return ok({
        **_serialize_user(user),
        "statistics": {
            "articles": article_count or 0,
            "comments": comment_count or 0,
            "favorites": favorite_count or 0,
        },
    })


# ---------------------------------------------------------------------------
# PUT /api/user/profile
# ---------------------------------------------------------------------------


class UpdateProfileRequest(BaseModel):
    username: str | None = None
    email: EmailStr | None = None


@router.put("/user/profile")
async def update_profile(
    body: UpdateProfileRequest,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if not body.username and not body.email:
        return fail("没有需要修改的数据")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return fail("用户不存在")

    if body.username:
        exists = await session.scalar(
            select(User.id).where(User.username == body.username, User.id != user_id)
        )
        if exists is not None:
            return fail("用户名已存在")
        user.username = body.username

    if body.email:
        exists = await session.scalar(
            select(User.id).where(User.email == body.email, User.id != user_id)
        )
        if exists is not None:
            return fail("邮箱已存在")
        user.email = body.email

    await session.flush()
    return ok(_serialize_user(user), message="资料修改成功")


# ---------------------------------------------------------------------------
# PUT /api/user/password
# ---------------------------------------------------------------------------


class UpdatePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.put("/user/password")
async def update_password(
    body: UpdatePasswordRequest,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if len(body.new_password) < 6:
        return fail("密码长度不能少于6位")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return fail("用户不存在")

    if not verify_password(body.old_password, user.password_hash):
        return fail("旧密码错误")

    user.password_hash = hash_password(body.new_password)
    await session.flush()
    return ok(message="密码修改成功, 请重新登录")


# ---------------------------------------------------------------------------
# GET /api/user/articles
# ---------------------------------------------------------------------------


@router.get("/user/articles")
async def my_articles(
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Article)
        .options(joinedload(Article.category), joinedload(Article.tags))
        .where(Article.author_id == user_id, Article.deleted_at.is_(None))
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
            "category_name": a.category.name if a.category else None,
            "tags": [{"id": t.id, "name": t.name} for t in a.tags],
        }
        for a in articles
    ]
    return ok({"items": items})


# ---------------------------------------------------------------------------
# GET /api/user/comments
# ---------------------------------------------------------------------------


@router.get("/user/comments")
async def my_comments(
    user_id: CurrentUser,
    pagination: dict = Depends(pagination_params),
    session: AsyncSession = Depends(get_session),
):
    page = pagination["page"]
    page_size = pagination["page_size"]
    offset = pagination["offset"]

    total = (
        await session.scalar(
            select(func.count(Comment.id)).where(
                Comment.user_id == user_id, Comment.deleted_at.is_(None)
            )
        )
        or 0
    )

    result = await session.execute(
        select(Comment)
        .options(joinedload(Comment.article))
        .where(Comment.user_id == user_id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.desc())
        .offset(offset)
        .limit(page_size)
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
        }
        for c in comments
    ]
    pages = (total + page_size - 1) // page_size
    return ok({
        "items": items,
        "pagination": {"page": page, "page_size": page_size, "total": total, "pages": pages},
    })


# ---------------------------------------------------------------------------
# GET /api/user/favorites
# ---------------------------------------------------------------------------


@router.get("/user/favorites")
async def my_favorites(
    user_id: CurrentUser,
    pagination: dict = Depends(pagination_params),
    session: AsyncSession = Depends(get_session),
):
    page = pagination["page"]
    page_size = pagination["page_size"]
    offset = pagination["offset"]

    total = (
        await session.scalar(
            select(func.count(ArticleFavorite.id))
            .join(Article, ArticleFavorite.article_id == Article.id)
            .where(ArticleFavorite.user_id == user_id, Article.deleted_at.is_(None))
        )
        or 0
    )

    result = await session.execute(
        select(ArticleFavorite)
        .options(joinedload(ArticleFavorite.article))
        .join(Article, ArticleFavorite.article_id == Article.id)
        .where(ArticleFavorite.user_id == user_id, Article.deleted_at.is_(None))
        .order_by(ArticleFavorite.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    favorites = result.unique().scalars().all()

    items = [
        {
            "id": f.article.id if f.article else None,
            "title": f.article.title if f.article else None,
            "slug": f.article.slug if f.article else None,
            "summary": f.article.summary if f.article else None,
            "cover_image": f.article.cover_image if f.article else None,
            "status": f.article.status if f.article else None,
            "favorite_time": f.created_at.isoformat() if f.created_at else None,
        }
        for f in favorites
        if f.article is not None
    ]
    pages = (total + page_size - 1) // page_size
    return ok({
        "items": items,
        "pagination": {"page": page, "page_size": page_size, "total": total, "pages": pages},
    })
