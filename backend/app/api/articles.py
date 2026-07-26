"""Article CRUD routes."""

import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, insert, select, text
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import joinedload

from app.config import settings
from app.database import AsyncSession, get_session
from app.dependencies import CurrentUser, OptionalUser, pagination_params

# Dev/test use SQLite; production uses MySQL. The two dialects need different
# "insert or ignore on conflict" syntax for idempotent view counting.
IS_SQLITE = "sqlite" in settings.SQLALCHEMY_DATABASE_URI
from app.models.article import Article, article_tags
from app.models.interaction import ArticleLike, ArticleView
from app.models.tag import Tag
from app.models.user import User
from app.schemas import ok

router = APIRouter(prefix="/api/articles", tags=["articles"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _slugify(text: str) -> str:
    if not text:
        return ""
    base = str(text).lower()
    base = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", base)
    return base.strip("-")


async def _generate_unique_slug(session: AsyncSession, title: str) -> str:
    slug = _slugify(title)
    if not slug:
        slug = uuid4().hex[:12]
    exists = await session.scalar(select(Article.id).where(Article.slug == slug))
    if exists is None:
        return slug
    return f"{slug}-{uuid4().hex[:6]}"


async def _assert_visible(session: AsyncSession, article: Article, identity: int | None) -> None:
    if article.status == "published":
        return
    if not identity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在")
    if article.author_id == identity:
        return
    user_result = await session.execute(select(User.role).where(User.id == identity))
    role = user_result.scalar_one_or_none()
    if role == "admin":
        return
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在")


async def _get_article_or_404(session: AsyncSession, article_id: int) -> Article:
    result = await session.execute(
        select(Article)
        .options(
            joinedload(Article.author),
            joinedload(Article.category),
            joinedload(Article.tags),
        )
        .where(Article.id == article_id)
    )
    article = result.unique().scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在")
    return article


async def _require_owner_or_admin(session: AsyncSession, article: Article, user_id: int) -> None:
    """Allow the author or an admin to modify the article; others get 403."""
    if article.author_id == user_id:
        return
    result = await session.execute(select(User.role).where(User.id == user_id))
    role = result.scalar_one_or_none()
    if role == "admin":
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="无权操作他人文章",
    )


def _serialize_article(article: Article) -> dict:
    return {
        "id": article.id,
        "title": article.title,
        "slug": article.slug,
        "summary": article.summary,
        "content": article.content,
        "cover_image": article.cover_image,
        "status": article.status,
        "views": article.views,
        "author_id": article.author_id,
        "category_id": article.category_id,
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "created_at": article.created_at.isoformat() if article.created_at else None,
        "updated_at": article.updated_at.isoformat() if article.updated_at else None,
        "author": {
            "id": article.author.id,
            "username": article.author.username,
            "avatar": article.author.avatar,
        } if article.author else None,
        "category": {
            "id": article.category.id,
            "name": article.category.name,
            "slug": article.category.slug,
        } if article.category else None,
        "tags": [
            {"id": t.id, "name": t.name, "slug": t.slug}
            for t in (article.tags or [])
        ],
    }


async def _get_detail_response(
    session: AsyncSession,
    article: Article,
    identity: int | None,
    request: Request,
    count_view: bool = True,
) -> dict:
    """Common detail response builder (view counting, like info)."""
    ip = request.client.host if request.client else None
    # De-duplicate views per viewer so that a single visit is counted once even
    # if the detail endpoint is hit multiple times (e.g. React StrictMode fires
    # the data-fetching effect twice in development, or the client retries).
    # Logged-in users are keyed by user id; anonymous visitors by IP address.
    viewer_key = f"u:{identity}" if identity else f"ip:{ip or 'unknown'}"

    if count_view:
        if IS_SQLITE:
            view_stmt = sqlite_insert(ArticleView).values(
                article_id=article.id,
                user_id=identity,
                ip_address=ip,
                viewer_key=viewer_key,
            ).on_conflict_do_nothing(index_elements=["article_id", "viewer_key"])
        else:
            # MySQL: ON DUPLICATE KEY UPDATE with a no-op self-assignment. A genuine
            # insert reports rowcount == 1; a duplicate reports 2 (or 0), so only a
            # fresh insert bumps the counter.
            view_stmt = mysql_insert(ArticleView).values(
                article_id=article.id,
                user_id=identity,
                ip_address=ip,
                viewer_key=viewer_key,
            ).on_duplicate_key_update(viewer_key=ArticleView.viewer_key)

        result = await session.execute(view_stmt)
        # Only count the view when the upsert actually inserted a new row.
        if result.rowcount == 1:
            await session.execute(
                text("UPDATE articles SET views = views + 1 WHERE id = :id").bindparams(id=article.id)
            )

    like_count = await session.scalar(
        select(func.count(ArticleLike.id)).where(ArticleLike.article_id == article.id)
    ) or 0

    liked = False
    if identity:
        liked = await session.scalar(
            select(ArticleLike.id).where(
                ArticleLike.article_id == article.id,
                ArticleLike.user_id == identity,
            )
        ) is not None

    data = _serialize_article(article)
    data["like_count"] = like_count
    data["liked"] = liked
    return data


# ---------------------------------------------------------------------------
# POST /api/articles — Create
# ---------------------------------------------------------------------------


class CreateArticleRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str | None = None
    summary: str | None = None
    cover_image: str | None = None
    status: str = "draft"
    category_id: int | None = None
    tag_ids: list[int] = Field(default_factory=list)


@router.post("")
async def create_article(
    body: CreateArticleRequest,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    slug = await _generate_unique_slug(session, body.title)

    article = Article(
        title=body.title,
        slug=slug,
        content=body.content,
        summary=body.summary,
        cover_image=body.cover_image,
        status=body.status,
        author_id=user_id,
        category_id=body.category_id,
        published_at=datetime.now(timezone.utc) if body.status == "published" else None,
    )
    session.add(article)
    await session.flush()

    if body.tag_ids:
        # Use association table directly — accessing article.tags triggers
        # a lazy load that fails in async SQLAlchemy.
        valid_tags = await session.execute(
            select(Tag.id).where(Tag.id.in_(body.tag_ids))
        )
        valid_ids = [row[0] for row in valid_tags]
        if valid_ids:
            await session.execute(
                insert(article_tags),
                [{"article_id": article.id, "tag_id": tid} for tid in valid_ids],
            )

    await session.flush()
    result = await session.execute(
        select(Article)
        .options(
            joinedload(Article.author),
            joinedload(Article.category),
            joinedload(Article.tags),
        )
        .where(Article.id == article.id)
    )
    article = result.unique().scalar_one()
    return ok(_serialize_article(article), message="文章创建成功")


# ---------------------------------------------------------------------------
# GET /api/articles — List
# ---------------------------------------------------------------------------


@router.get("")
async def list_articles(
    pagination: dict = Depends(pagination_params),
    status_param: str | None = Query(None, alias="status"),
    keyword: str | None = Query(None),
    category_id: int | None = Query(None),
    tag_id: int | None = Query(None),
    sort: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    page = pagination["page"]
    page_size = pagination["page_size"]
    offset = pagination["offset"]

    stmt = select(Article).where(Article.deleted_at.is_(None))

    if status_param:
        stmt = stmt.where(Article.status == status_param)
    if category_id:
        stmt = stmt.where(Article.category_id == category_id)
    if tag_id:
        stmt = stmt.join(article_tags).where(article_tags.c.tag_id == tag_id)
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where(
            Article.title.ilike(like) | Article.content.ilike(like)
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await session.scalar(count_stmt) or 0

    if sort == "views":
        stmt = stmt.order_by(Article.views.desc())
    else:
        stmt = stmt.order_by(Article.created_at.desc())

    result = await session.execute(
        stmt.options(
            joinedload(Article.author),
            joinedload(Article.category),
            joinedload(Article.tags),
        )
        .offset(offset)
        .limit(page_size)
    )
    articles = result.unique().scalars().all()

    items = [_serialize_article(a) for a in articles]
    pages = (total + page_size - 1) // page_size
    return ok({
        "items": items,
        "pagination": {"page": page, "page_size": page_size, "total": total, "pages": pages},
    })


# ---------------------------------------------------------------------------
# GET /api/articles/mine — Must come before /{lookup}
# ---------------------------------------------------------------------------


@router.get("/mine")
async def my_articles(
    user_id: CurrentUser,
    pagination: dict = Depends(pagination_params),
    status_param: str | None = Query(None, alias="status"),
    keyword: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    page = pagination["page"]
    page_size = pagination["page_size"]
    offset = pagination["offset"]

    stmt = select(Article).where(Article.author_id == user_id, Article.deleted_at.is_(None))

    if status_param:
        stmt = stmt.where(Article.status == status_param)
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where(Article.title.ilike(like))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await session.scalar(count_stmt) or 0

    result = await session.execute(
        stmt.options(joinedload(Article.category), joinedload(Article.tags))
        .order_by(Article.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    articles = result.unique().scalars().all()

    items = [_serialize_article(a) for a in articles]
    pages = (total + page_size - 1) // page_size
    return ok({
        "items": items,
        "pagination": {"page": page, "page_size": page_size, "total": total, "pages": pages},
    })


# ---------------------------------------------------------------------------
# GET /api/articles/{lookup} — Detail (by ID if numeric, else by slug)
# ---------------------------------------------------------------------------


@router.get("/{lookup}")
async def get_article_by_id_or_slug(
    lookup: str,
    identity: OptionalUser,
    request: Request,
    track_view: bool = Query(
        True,
        description="Whether this request should count as a view. Set to false "
        "for previews (e.g. search-by-id) or when the client already counted "
        "this visit in the current session to avoid inflating the counter.",
    ),
    session: AsyncSession = Depends(get_session),
):
    # Try as integer ID first, then fall back to slug
    article = None
    if lookup.isdigit():
        result = await session.execute(
            select(Article)
            .options(
                joinedload(Article.author),
                joinedload(Article.category),
                joinedload(Article.tags),
            )
            .where(Article.id == int(lookup))
        )
        article = result.unique().scalar_one_or_none()

    if article is None:
        result = await session.execute(
            select(Article)
            .options(
                joinedload(Article.author),
                joinedload(Article.category),
                joinedload(Article.tags),
            )
            .where(Article.slug == lookup)
        )
        article = result.unique().scalar_one_or_none()

    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在")

    await _assert_visible(session, article, identity)
    data = await _get_detail_response(session, article, identity, request, count_view=track_view)
    return ok(data)


# ---------------------------------------------------------------------------
# PUT /api/articles/{id} — Update
# ---------------------------------------------------------------------------


class UpdateArticleRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    summary: str | None = None
    cover_image: str | None = None
    status: str | None = None
    category_id: int | None = None
    tag_ids: list[int] | None = None


@router.put("/{article_id}")
async def update_article(
    article_id: int,
    body: UpdateArticleRequest,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    article = await _get_article_or_404(session, article_id)

    if article.author_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能编辑自己的文章")

    if body.title is not None and body.title != article.title:
        article.title = body.title
        article.slug = await _generate_unique_slug(session, body.title)

    if body.content is not None:
        article.content = body.content
    if body.summary is not None:
        article.summary = body.summary
    if body.cover_image is not None:
        article.cover_image = body.cover_image
    if body.category_id is not None:
        article.category_id = body.category_id

    if body.status is not None:
        article.status = body.status
        if body.status == "published" and not article.published_at:
            article.published_at = datetime.now(timezone.utc)

    if body.tag_ids is not None:
        article.tags.clear()
        for tid in body.tag_ids:
            tag = await session.get(Tag, tid)
            if tag:
                article.tags.append(tag)

    await session.flush()
    result = await session.execute(
        select(Article)
        .options(
            joinedload(Article.author),
            joinedload(Article.category),
            joinedload(Article.tags),
        )
        .where(Article.id == article_id)
    )
    article = result.unique().scalar_one()
    return ok(_serialize_article(article), message="文章更新成功")


# ---------------------------------------------------------------------------
# DELETE /api/articles/{id} — Soft delete
# ---------------------------------------------------------------------------


@router.delete("/{article_id}")
async def delete_article(
    article_id: int,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    article = await _get_article_or_404(session, article_id)

    if article.author_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能删除自己的文章")

    article.deleted_at = datetime.now(timezone.utc)
    await session.flush()
    return ok(message="文章删除成功")


# ---------------------------------------------------------------------------
# PUT /api/articles/{id}/restore — Restore
# ---------------------------------------------------------------------------


@router.put("/{article_id}/restore")
async def restore_article(
    article_id: int,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在")

    if article.author_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能恢复自己的文章")

    article.deleted_at = None
    await session.flush()
    return ok(message="文章恢复成功")


# ---------------------------------------------------------------------------
# PUT /api/articles/{id}/publish — Publish a draft
# ---------------------------------------------------------------------------


@router.put("/{article_id}/publish")
async def publish_article(
    article_id: int,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    article = await _get_article_or_404(session, article_id)
    await _require_owner_or_admin(session, article, user_id)

    article.status = "published"
    article.published_at = datetime.now(timezone.utc)
    await session.flush()

    # Re-fetch so the response reflects a fresh, consistent row (relationships
    # are re-loaded eagerly). Serializing the in-memory object after flush()
    # relies on expired attributes being lazily re-loaded, which is fragile in
    # async SQLAlchemy and inconsistent with create/update.
    result = await session.execute(
        select(Article)
        .options(
            joinedload(Article.author),
            joinedload(Article.category),
            joinedload(Article.tags),
        )
        .where(Article.id == article_id)
    )
    article = result.unique().scalar_one()
    return ok(_serialize_article(article), message="文章发布成功")


# ---------------------------------------------------------------------------
# PUT /api/articles/{id}/unpublish — Unpublish (back to draft)
# ---------------------------------------------------------------------------


@router.put("/{article_id}/unpublish")
async def unpublish_article(
    article_id: int,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    article = await _get_article_or_404(session, article_id)
    await _require_owner_or_admin(session, article, user_id)

    article.status = "draft"
    article.published_at = None
    await session.flush()

    # Re-fetch so the response reflects a fresh, consistent row (relationships
    # are re-loaded eagerly). Serializing the in-memory object after flush()
    # relies on expired attributes being lazily re-loaded, which is fragile in
    # async SQLAlchemy and inconsistent with create/update.
    result = await session.execute(
        select(Article)
        .options(
            joinedload(Article.author),
            joinedload(Article.category),
            joinedload(Article.tags),
        )
        .where(Article.id == article_id)
    )
    article = result.unique().scalar_one()
    return ok(_serialize_article(article), message="文章已取消发布")
