"""Comment routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.database import AsyncSession, get_session
from app.dependencies import CurrentUser
from app.models.comment import Comment
from app.schemas import ok

router = APIRouter(prefix="/api/comments", tags=["comments"])


class CreateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1)
    parent_id: int | None = None


def _serialize_comment(comment: Comment) -> dict:
    return {
        "id": comment.id,
        "content": comment.content,
        "status": comment.status,
        "parent_id": comment.parent_id,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "user": {
            "id": comment.user.id,
            "username": comment.user.username,
            "avatar": comment.user.avatar,
        } if comment.user else None,
    }


def _build_comment_tree(comments: list[Comment]) -> list[dict]:
    """Build nested comment tree."""
    # Map by id
    cmap: dict[int, dict] = {}
    roots: list[dict] = []

    for c in comments:
        node = _serialize_comment(c)
        node["replies"] = []
        cmap[c.id] = node

    for c in comments:
        node = cmap[c.id]
        if c.parent_id and c.parent_id in cmap:
            cmap[c.parent_id]["replies"].append(node)
        else:
            roots.append(node)

    return roots


# ---------------------------------------------------------------------------
# POST /api/comments/article/{article_id}
# ---------------------------------------------------------------------------


@router.post("/article/{article_id:int}")
async def create_comment(
    article_id: int,
    body: CreateCommentRequest,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    comment = Comment(
        article_id=article_id,
        user_id=user_id,
        parent_id=body.parent_id,
        content=body.content,
    )
    session.add(comment)
    await session.flush()

    # Reload with user
    result = await session.execute(
        select(Comment)
        .options(joinedload(Comment.user))
        .where(Comment.id == comment.id)
    )
    comment = result.unique().scalar_one()
    return ok(_serialize_comment(comment), message="评论成功")


# ---------------------------------------------------------------------------
# GET /api/comments/article/{article_id}
# ---------------------------------------------------------------------------


@router.get("/article/{article_id:int}")
async def get_article_comments(
    article_id: int,
    session: AsyncSession = Depends(get_session),
):
    # Load all comments for tree building
    all_result = await session.execute(
        select(Comment)
        .options(joinedload(Comment.user))
        .where(
            Comment.article_id == article_id,
            Comment.deleted_at.is_(None),
        )
        .order_by(Comment.created_at.asc())
    )
    all_comments = all_result.unique().scalars().all()

    items = _build_comment_tree(list(all_comments))
    return ok({"items": items})


# ---------------------------------------------------------------------------
# DELETE /api/comments/{id}
# ---------------------------------------------------------------------------


@router.delete("/{comment_id:int}")
async def delete_comment(
    comment_id: int,
    user_id: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Comment).where(Comment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="评论不存在")

    if comment.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能删除自己的评论")

    comment.deleted_at = datetime.now(timezone.utc)
    await session.flush()
    return ok(message="评论删除成功")
