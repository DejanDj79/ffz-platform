#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile tls \
  run --rm certbot \
  renew \
  --webroot \
  --webroot-path /var/www/certbot \
  --quiet

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T nginx \
  nginx -s reload

echo "Let's Encrypt renewal check complete; nginx reloaded."
