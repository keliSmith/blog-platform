#!/usr/bin/env bash
#
# 前端一键部署脚本 (多阶段构建模式)
# 流程: 服务器拉取最新源码 -> 重建前端镜像(镜像内自动 npm ci + vite build) -> 重启容器
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

echo "==> 1. 服务器拉取最新前端源码"
ssh "$SERVER" "cd $REMOTE_DIR && git pull"

echo "==> 2. 重建前端镜像 (镜像内自动 npm ci + vite build) 并重启容器"
# 多阶段 Dockerfile 已在容器内完成依赖安装与构建, 无需本地预构建 / 上传 dist
ssh "$SERVER" "cd $REMOTE_DIR/deploy && \
  docker compose -f docker-compose.prod.yml build frontend && \
  docker compose -f docker-compose.prod.yml up -d frontend"

echo ""
echo "==================================================="
echo " 前端部署完成! 访问 https://\$DOMAIN (DOMAIN 见 .env.prod)"
echo "==================================================="
