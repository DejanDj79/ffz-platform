#!/usr/bin/env bash
set -euo pipefail
AGARVIZ_ROOT="${AGARVIZ_ROOT:-$HOME/apps/AgarViz}"
NGINX_CONTAINER="${NGINX_CONTAINER:-agarviz-nginx-1}"
SOURCE="deploy/nginx-shared/ffz-bootstrap.conf"
DEST="${AGARVIZ_ROOT}/deploy/nginx/conf.d/ffz.conf"

[[ -f "$SOURCE" ]] || { echo "Missing $SOURCE" >&2; exit 1; }
[[ -d "${AGARVIZ_ROOT}/deploy/nginx/conf.d" ]] || { echo "AgarViz nginx config directory not found." >&2; exit 1; }

cp "$SOURCE" "$DEST"
docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload
echo "FFZ ACME bootstrap config installed: $DEST"
