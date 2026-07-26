"""SQLAlchemy 2.0 async models — Like, Favorite, View interactions."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Length of the de-duplication key used to count one view per viewer
# (logged-in user -> "u:<id>", anonymous -> "ip:<address>").
VIEWER_KEY_LENGTH = 64

from app.database import Base

if TYPE_CHECKING:
    from app.models.article import Article
    from app.models.user import User


class ArticleLike(Base):
    __tablename__ = "article_likes"
    __table_args__ = (
        UniqueConstraint("article_id", "user_id", name="uq_article_user_like"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    article_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    article: Mapped["Article"] = relationship("Article", lazy="joined")
    user: Mapped["User"] = relationship("User", lazy="joined")


class ArticleFavorite(Base):
    __tablename__ = "article_favorites"
    __table_args__ = (
        UniqueConstraint("article_id", "user_id", name="uq_article_user_favorite"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    article_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    article: Mapped["Article"] = relationship("Article", lazy="joined")
    user: Mapped["User"] = relationship("User", lazy="joined")


class ArticleView(Base):
    __tablename__ = "article_views"
    __table_args__ = (
        UniqueConstraint("article_id", "viewer_key", name="uq_article_viewer"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    article_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    # Stable de-duplication key: "u:<user_id>" for logged-in users,
    # "ip:<ip_address>" for anonymous visitors. The unique constraint on
    # (article_id, viewer_key) guarantees a viewer is counted at most once
    # per row, so duplicate / concurrent detail requests cannot inflate views.
    viewer_key: Mapped[str] = mapped_column(String(VIEWER_KEY_LENGTH), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    article: Mapped["Article"] = relationship("Article", lazy="joined")
