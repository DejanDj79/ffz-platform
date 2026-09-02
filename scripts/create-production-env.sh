#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage:"
  echo "  ./scripts/create-production-env.sh app.example.com you@example.com"
  exit 1
fi

if [[ -e .env.production ]]; then
  echo ".env.production already exists; refusing to overwrite it."
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required."
  exit 1
fi

DB_PASSWORD="$(openssl rand -hex 32)"
RATE_SALT="$(openssl rand -hex 32)"

cat > .env.production <<EOF
FFZ_DOMAIN=${DOMAIN}
LETSENCRYPT_EMAIL=${EMAIL}

FFZ_HTTP_PORT=80
FFZ_HTTPS_PORT=443

POSTGRES_DB=ffz_platform
POSTGRES_USER=ffz
POSTGRES_PASSWORD=${DB_PASSWORD}

AUTH_RATE_LIMIT_SALT=${RATE_SALT}
EOF

chmod 600 .env.production

echo "Created .env.production"
echo "Permissions: 600"
echo
echo "Do not commit this file."
