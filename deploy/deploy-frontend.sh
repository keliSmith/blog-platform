#!/usr/bin/env bash
#
# 前端一键部署脚本 (本地构建 + SCP 模式)
# 流程: 本地 npm ci + vite build -> SCP dist 到服务器 -> 重启 nginx 容器并 reload
# 服务器不再跑 vite build (避免小机器打包卡死), 只做秒级 nginx up + reload。
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

echo "==> 1. 本地构建前端 (npm ci + vite build)"
cd "$SCRIPT_DIR/../frontend"
npm config set registry https://registry.npmmirror.com
npm ci
npm run build
cd "$SCRIPT_DIR"

echo "==> 2. 上传 dist 到服务器 ($REMOTE_DIR/frontend/dist)"
ssh "$SERVER" "mkdir -p $REMOTE_DIR/frontend/dist"
scp -r "$SCRIPT_DIR/../frontend/dist/." "$SERVER:$REMOTE_DIR/frontend/dist/"

echo "==> 3. 服务器重启前端容器并 reload nginx"
ssh "$SERVER" "cd $REMOTE_DIR/deploy && \
  docker compose -f docker-compose.prod.yml up -d --build frontend && \
  docker compose -f docker-compose.prod.yml exec -T frontend nginx -s reload"

echo ""
echo "==================================================="
echo " 前端部署完成! 访问 https://\$DOMAIN (DOMAIN 见 .env.prod)"
echo "==================================================="
