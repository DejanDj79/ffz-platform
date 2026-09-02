#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

[[ -f "$ENV_FILE" ]] || {
  echo "$ENV_FILE does not exist." >&2
  exit 1
}

DOMAIN="$(
  sed -n 's/^FFZ_DOMAIN=//p' "$ENV_FILE" | head -n1
)"

EMAIL="$(
  sed -n 's/^LETSENCRYPT_EMAIL=//p' "$ENV_FILE" | head -n1
)"

[[ -n "$DOMAIN" ]] || {
  echo "FFZ_DOMAIN is missing." >&2
  exit 1
}

[[ -n "$EMAIL" ]] || {
  echo "LETSENCRYPT_EMAIL is missing." >&2
  exit 1
}

echo "Starting FFZ in HTTP bootstrap mode..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d postgres app nginx

echo
echo "Requesting Let's Encrypt certificate for:"
echo "  $DOMAIN"
echo
echo "DNS for this domain MUST already point to this server."

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile tls \
  run --rm certbot \
  certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo
echo "Restarting nginx so it detects the new certificate..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  restart nginx

echo
echo "Certificate installed."
echo "Open:"
echo "  https://$DOMAIN"
