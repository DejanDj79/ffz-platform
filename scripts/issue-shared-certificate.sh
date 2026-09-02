#!/usr/bin/env bash
set -euo pipefail
EMAIL="${1:-}"
CERTBOT_WEBROOT_VOLUME="${CERTBOT_WEBROOT_VOLUME:-agarviz_certbot_webroot}"
LETSENCRYPT_VOLUME="${LETSENCRYPT_VOLUME:-agarviz_letsencrypt}"

[[ -n "$EMAIL" ]] || { echo "Usage: ./scripts/issue-shared-certificate.sh you@example.com" >&2; exit 1; }

docker run --rm \
  -v "${CERTBOT_WEBROOT_VOLUME}:/var/www/certbot" \
  -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt" \
  certbot/certbot:latest \
  certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d ffz.app \
  -d www.ffz.app

echo "Certificate request completed."
