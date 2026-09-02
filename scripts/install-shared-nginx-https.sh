#!/usr/bin/env bash
set -euo pipefail
AGARVIZ_ROOT="${AGARVIZ_ROOT:-$HOME/apps/AgarViz}"
NGINX_CONTAINER="${NGINX_CONTAINER:-agarviz-nginx-1}"
SOURCE="deploy/nginx-shared/ffz.conf"
DEST="${AGARVIZ_ROOT}/deploy/nginx/conf.d/ffz.conf"

docker exec "$NGINX_CONTAINER" test -f /etc/letsencrypt/live/ffz.app/fullchain.pem
docker exec "$NGINX_CONTAINER" test -f /etc/letsencrypt/live/ffz.app/privkey.pem
cp "$SOURCE" "$DEST"
docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload
echo "FFZ HTTPS virtual host enabled: https://ffz.app"
