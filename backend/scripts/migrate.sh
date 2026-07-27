#!/usr/bin/env bash
#
# 生产环境数据库迁移脚本 (Alembic)
# 在 backend 容器内执行 `alembic upgrade head`, 容器已正确注入
# APP_ENV=production 与 DATABASE_URL (来自 compose 的 environment + env_file)。
#
# 可安全重复执行: Alembic 是幂等的, 只会应用尚未执行的迁移。
#
# 用法:
#   bash backend/scripts/migrate.sh
#   (需在能访问 docker 的环境运行, 且 deploy/.env.prod 存在)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# backend/scripts -> ../../deploy
DEPLOY_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)/deploy"

cd "$DEPLOY_DIR"

# 载入 .env.prod, 让 docker compose 能正确插值 ${MYSQL_USER}/${MYSQL_PASSWORD} 等变量,
# 同时保证 backend 容器拿到真实数据库凭证。
if [ -f .env.prod ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.prod
  set +a
else
  echo "警告: $DEPLOY_DIR/.env.prod 不存在, 将使用 compose 文件中的默认值" >&2
fi

echo "==> 运行数据库迁移: alembic upgrade head"
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
