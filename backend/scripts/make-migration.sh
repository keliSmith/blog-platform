#!/usr/bin/env bash
# 本地生成 Alembic 迁移（Windows Git Bash / Mac / Linux 通用）
#
# 用法:
#   ./make-migration.sh "add viewer_key to article_views"
#   DATABASE_URL="sqlite+aiosqlite:///./other.db" ./make-migration.sh "some change"
#
# 说明:
#   - 自动定位一个装有 alembic 的 Python（优先用托管 venv，其次 .venv/venv，最后 PATH 里的 python）
#   - 默认连本地 dev.db；可用环境变量 DATABASE_URL 覆盖
#   - 生成后请人工审阅 migrations/versions/ 下的新文件再提交
set -euo pipefail

# 切到 backend 目录（脚本位于 backend/scripts/）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

# 候选 Python 解释器（按优先级）
CANDIDATES=(
  "python"
  "python3"
  "$HOME/.workbuddy/binaries/python/envs/blog-alembic/Scripts/python.exe"
  "$HOME/.workbuddy/binaries/python/envs/blog-alembic/bin/python"
  "$BACKEND_DIR/.venv/Scripts/python.exe"
  "$BACKEND_DIR/.venv/bin/python"
  "$BACKEND_DIR/venv/Scripts/python.exe"
  "$BACKEND_DIR/venv/bin/python"
)

PYTHON_BIN=""
for cand in "${CANDIDATES[@]}"; do
  # 必须能同时导入 alembic 与应用模型（覆盖 sqlalchemy/aiosqlite/pydantic 等依赖），
  # 否则挑中“只装了 alembic、缺项目依赖”的 python 会在 autogenerate 时崩溃
  if [ -x "$cand" ] && PYTHONPATH="$BACKEND_DIR" "$cand" -c "import alembic, app.models" >/dev/null 2>&1; then
    PYTHON_BIN="$cand"
    break
  fi
done

if [ -z "$PYTHON_BIN" ]; then
  echo "❌ 找不到带完整依赖的 Python（需 alembic + sqlalchemy + aiosqlite + pydantic-settings）。" >&2
  echo "   请先安装: pip install alembic 'sqlalchemy[asyncio]' aiosqlite pydantic-settings python-dotenv" >&2
  exit 1
fi

# 默认连本地 dev.db（除非已设置 DATABASE_URL）
export DATABASE_URL="${DATABASE_URL:-sqlite+aiosqlite:///./dev.db}"
export PYTHONPATH="$BACKEND_DIR${PYTHONPATH:+:$PYTHONPATH}"

if [ $# -lt 1 ]; then
  echo "用法: $0 \"迁移说明信息\"" >&2
  exit 1
fi

MSG="$1"
echo "==> 使用 Python: $PYTHON_BIN"
echo "==> DATABASE_URL: $DATABASE_URL"
echo "==> 生成迁移: $MSG"
"$PYTHON_BIN" -m alembic revision --autogenerate -m "$MSG"

echo ""
echo "✅ 迁移已生成。请审阅 migrations/versions/ 下的新文件，确认无误后 git commit && git push。"
