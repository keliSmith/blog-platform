#!/usr/bin/env bash
#
# 在阿里云 ECS (Alibaba Cloud Linux / CentOS / Ubuntu) 上安装 Docker 与 compose 插件。
# 用法:  sudo bash deploy/setup-host.sh
#
set -euo pipefail

if command -v docker >/dev/null 2>&1; then
  echo "docker 已安装, 跳过安装"
else
  echo "==> 安装 Docker (官方脚本)"
  curl -fsSL https://get.docker.com | sh
fi

if docker compose version >/dev/null 2>&1; then
  echo "docker compose 插件已存在"
else
  echo "==> 安装 docker-compose-plugin"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y docker-compose-plugin
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y docker-compose-plugin
  elif command -v yum >/dev/null 2>&1; then
    yum install -y docker-compose-plugin
  else
    echo "无法识别包管理器, 请手动安装 docker-compose-plugin"; exit 1
  fi
fi

systemctl enable --now docker

echo ""
echo "Docker 安装完成。"
echo "建议将当前用户加入 docker 组以避免每次 sudo:"
echo "  sudo usermod -aG docker \$USER"
echo "然后退出重新登录。"
