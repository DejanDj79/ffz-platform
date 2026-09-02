#!/bin/sh
set -eu

DOMAIN="${FFZ_DOMAIN:?FFZ_DOMAIN is required}"
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

if [ -f "$CERT" ] && [ -f "$KEY" ]; then
  TEMPLATE="/etc/nginx/ffz-templates/https.conf.template"
  echo "FFZ nginx: TLS certificate found for ${DOMAIN}; enabling HTTPS."
else
  TEMPLATE="/etc/nginx/ffz-templates/http.conf.template"
  echo "FFZ nginx: no TLS certificate found yet; starting HTTP bootstrap mode."
fi

envsubst '${FFZ_DOMAIN}' \
  < "$TEMPLATE" \
  > /etc/nginx/conf.d/default.conf
