#!/usr/bin/env bash
#
# Let's Encrypt 证书续期 (由系统 cron 每天调用)
# 用法(加到 crontab):
#   0 3 * * * /path/to/deploy/certbot-renew.sh >> /var/log/certbot-renew.log 2>&1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot renew --webroot -w /var/www/certbot
docker compose -f docker-compose.prod.yml exec -T frontend nginx -s reload
