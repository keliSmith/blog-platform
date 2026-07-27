"""add viewer_key to article_views (idempotent, for legacy MySQL)

Revision ID: 9f3c2a1b8d7e
Revises: f6a07e5dea48
Create Date: 2026-07-27 11:05:00.000000

背景:
  早期 init.sql 建立的 production MySQL 中 article_views 表缺少 viewer_key 列
  (模型后加的去重计数字段)。本迁移在列不存在时补齐，并在有历史数据时回填唯一值，
  再建立 (article_id, viewer_key) 唯一约束。本地 dev.db 已含该列，会整体跳过 (幂等)。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f3c2a1b8d7e'
down_revision: Union[str, None] = 'f6a07e5dea48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    dialect = bind.dialect.name

    existing_cols = {c["name"] for c in insp.get_columns("article_views")}
    if "viewer_key" not in existing_cols:
        # 1) 加列（SQLite / MySQL 均支持直接 ADD COLUMN）
        op.add_column(
            "article_views",
            sa.Column("viewer_key", sa.String(64), nullable=False, server_default=""),
        )
        # 2) 回填唯一值，避免后续唯一约束因空值冲突
        if dialect == "mysql":
            bind.execute(
                sa.text(
                    "UPDATE article_views "
                    "SET viewer_key = CONCAT('legacy_', id) "
                    "WHERE viewer_key = '' OR viewer_key IS NULL"
                )
            )
        else:
            bind.execute(
                sa.text(
                    "UPDATE article_views "
                    "SET viewer_key = 'legacy_' || id "
                    "WHERE viewer_key = '' OR viewer_key IS NULL"
                )
            )

    # 3) 加唯一约束（幂等：已存在则跳过）
    existing_constraints = {c["name"] for c in insp.get_unique_constraints("article_views")}
    if "uq_article_viewer" not in existing_constraints:
        if dialect == "mysql":
            op.create_unique_constraint(
                "uq_article_viewer", "article_views", ["article_id", "viewer_key"]
            )
        else:
            # SQLite 不支持 ALTER ADD CONSTRAINT，需表重建
            with op.batch_alter_table("article_views") as batch_op:
                batch_op.create_unique_constraint(
                    "uq_article_viewer", ["article_id", "viewer_key"]
                )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    dialect = bind.dialect.name

    existing_constraints = {c["name"] for c in insp.get_unique_constraints("article_views")}
    if "uq_article_viewer" in existing_constraints:
        if dialect == "mysql":
            op.drop_constraint("uq_article_viewer", "article_views", type_="unique")
        else:
            with op.batch_alter_table("article_views") as batch_op:
                batch_op.drop_constraint("uq_article_viewer", type_="unique")

    existing_cols = {c["name"] for c in insp.get_columns("article_views")}
    if "viewer_key" in existing_cols:
        if dialect == "mysql":
            op.drop_column("article_views", "viewer_key")
        else:
            with op.batch_alter_table("article_views") as batch_op:
                batch_op.drop_column("viewer_key")
