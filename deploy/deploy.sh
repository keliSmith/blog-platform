#!/usr/bin/env bash
#
# blog-platform 生产一键部署脚本 (Docker Compose 一体化)
# 用法:  bash deploy/deploy.sh
#
# 流程: 准备 .env.prod -> 起 MySQL/Redis -> 起后端 -> 起前端(HTTP)
#       -> 申请 Let's Encrypt 证书 -> 切 HTTPS -> (可选)创建管理员
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
NGINX_DIR="nginx"

# ---- 环境检查 ----
if ! command -v docker >/dev/null 2>&1; then
  echo "错误: 未检测到 docker。请先运行: bash deploy/setup-host.sh"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "错误: docker compose 插件不可用, 请先运行: bash deploy/setup-host.sh"
  exit 1
fi

# ---- 1. 生成 .env.prod ----
if [ ! -f "$ENV_FILE" ]; then
  cp .env.prod.example "$ENV_FILE"
  echo "已生成 $ENV_FILE, 请编辑以下字段后重新运行本脚本:"
  echo "  DOMAIN  EMAIL  MYSQL_ROOT_PASSWORD  MYSQL_PASSWORD  SECRET_KEY  JWT_SECRET_KEY"
  echo "(SECRET_KEY / JWT_SECRET_KEY 若保持 __CHANGE_ME__ 会自动生成; 其余需你填写)"
  exit 1
fi

get_env() { grep "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2-; }
set_env() {
  if grep -q "^$1=" "$ENV_FILE"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else
    echo "$1=$2" >> "$ENV_FILE"
  fi
}

# ---- 2. 占位符密钥自动生成 ----
[ "$(get_env SECRET_KEY)" = "__CHANGE_ME__" ] && set_env SECRET_KEY "$(openssl rand -hex 32)"
[ "$(get_env JWT_SECRET_KEY)" = "__CHANGE_ME__" ] && set_env JWT_SECRET_KEY "$(openssl rand -hex 32)"

# ---- 3. 载入环境变量 (供 compose ${VAR} 插值) ----
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ---- 4. 校验占位符 ----
DOMAIN="$(get_env DOMAIN)"
EMAIL="$(get_env EMAIL)"
bad=0
for v in DOMAIN EMAIL MYSQL_ROOT_PASSWORD MYSQL_PASSWORD SECRET_KEY JWT_SECRET_KEY; do
  val="$(get_env "$v")"
  case "$val" in
    __YOUR_DOMAIN__|__YOUR_EMAIL__|__CHANGE_ME__|__CHANGE_ME_ROOT__|__CHANGE_ME_USER__|"")
      echo "错误: $v 仍为占位符或为空, 请编辑 $ENV_FILE"; bad=1;;
  esac
done
[ "$bad" -eq 1 ] && exit 1

# ---- 5. UPLOAD_BASE_URL ----
ub="$(get_env UPLOAD_BASE_URL)"
if [ -z "$ub" ] || echo "$ub" | grep -q "YOUR_DOMAIN"; then
  set_env UPLOAD_BASE_URL "https://$DOMAIN"
  export UPLOAD_BASE_URL="https://$DOMAIN"
fi

echo "==> 部署域名: $DOMAIN (含 www.$DOMAIN)"

# www 子域名作为 SAN 加入同一张证书; nginx server_name 同时匹配两者
DOMAIN_LIST="$DOMAIN www.$DOMAIN"

# ---- 6. 基础设施 ----
echo "==> 启动 MySQL / Redis"
docker compose -f "$COMPOSE_FILE" up -d mysql redis

echo "==> 等待 MySQL 就绪"
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T mysql mysqladmin ping -h localhost -p"$MYSQL_ROOT_PASSWORD" >/dev/null 2>&1; then
    echo "MySQL 就绪"; break
  fi
  sleep 2
done

# ---- 7. 后端 ----
echo "==> 构建并启动后端"
docker compose -f "$COMPOSE_FILE" up -d --build backend

# ---- 8. 前端 (先 HTTP, 以便申请证书) ----
echo "==> 写入 HTTP 临时配置并启动前端(Nginx)"
sed -e "s|{{DOMAIN}}|$DOMAIN|g" -e "s|{{DOMAIN_LIST}}|$DOMAIN_LIST|g" "$NGINX_DIR/default.conf.http" > "$NGINX_DIR/default.conf"
docker compose -f "$COMPOSE_FILE" up -d --build frontend

# ---- 9. 申请证书 ----
if docker compose -f "$COMPOSE_FILE" exec -T frontend test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null; then
  echo "==> 证书已存在, 跳过申请"
else
  echo "==> 申请 Let's Encrypt 证书 (请确保 $DOMAIN 与 www.$DOMAIN 均已解析到本机且 80 端口开放)"
  docker compose -f "$COMPOSE_FILE" --profile certbot run --rm certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --email "$EMAIL" --agree-tos --no-eff-email --non-interactive
fi

# ---- 10. 切换 HTTPS ----
echo "==> 切换 HTTPS 配置并 reload Nginx"
sed -e "s|{{DOMAIN}}|$DOMAIN|g" -e "s|{{DOMAIN_LIST}}|$DOMAIN_LIST|g" "$NGINX_DIR/default.conf.https" > "$NGINX_DIR/default.conf"
docker compose -f "$COMPOSE_FILE" exec -T frontend nginx -s reload

echo ""
echo "==================================================="
echo " 部署完成!"
echo " 前台: https://$DOMAIN  (含 https://www.$DOMAIN)"
echo " 接口健康检查: https://$DOMAIN/api/health"
echo "==================================================="
echo ""
read -r -p "是否现在创建管理员账号? (y/N) " ans
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
  read -r -p "管理员用户名: " AUSER
  read -r -p "管理员邮箱: " AEMAIL
  read -r -s -p "管理员密码: " APWD
  echo
  docker compose -f "$COMPOSE_FILE" exec -T backend python scripts/make_admin.py "$AUSER" "$AEMAIL" "$APWD"
  echo "管理员创建完成, 可用该账号登录后台 /admin"
fi
