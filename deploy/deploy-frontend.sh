#!/usr/bin/env bash
#
# 前端一键部署脚本 (预构建产物模式)
# 流程: 本地 npm 构建 -> rsync dist 到服务器 -> 服务器重建并重启前端容器
# 用法:  bash deploy/deploy-frontend.sh
#
# 首次使用前请修改下面的 SERVER / REMOTE_DIR (或通过环境变量传入):
#   DEPLOY_SERVER=user@1.2.3.4  DEPLOY_REMOTE_DIR=/opt/blog-platform  bash deploy/deploy-frontend.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ====== 按需修改 (或用环境变量覆盖) ======
SERVER="${DEPLOY_SERVER:-user@your-server-ip}"        # 服务器 SSH 地址, 例如 root@1.2.3.4 或 deploy@blog.example.com
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/blog-platform}"  # 服务器上项目根目录 (deploy/ 的上一级)
# =========================================

FRONTEND_DIR="$SCRIPT_DIR/../frontend"

echo "==> 1. 本地构建前端"
cd "$FRONTEND_DIR"
npm install
npm run build
cd "$SCRIPT_DIR"

echo "==> 2. 同步 dist 到服务器 $SERVER:$REMOTE_DIR/frontend/dist"
rsync -az --delete "$FRONTEND_DIR/dist/" "$SERVER:$REMOTE_DIR/frontend/dist/"

echo "==> 3. 在服务器重建并重启前端容器"
# 镜像很小 (只 COPY dist 给 nginx), build 通常 1~2 秒
ssh "$SERVER" "cd $REMOTE_DIR/deploy && \
  docker compose -f docker-compose.prod.yml build frontend && \
  docker compose -f docker-compose.prod.yml up -d frontend"

echo ""
echo "==================================================="
echo " 前端部署完成! 访问 https://\$DOMAIN (DOMAIN 见 .env.prod)"
echo "==================================================="
