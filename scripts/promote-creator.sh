#!/usr/bin/env bash
set -euo pipefail

EMAIL="${1:-}"
ENV_FILE="${2:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

if [[ -z "$EMAIL" ]]; then
  echo "Usage: ./scripts/promote-creator.sh email@example.com"
  exit 1
fi

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres \
  psql \
    -U "${POSTGRES_USER:-ffz}" \
    -d "${POSTGRES_DB:-ffz_platform}" \
    -v email="$EMAIL" <<'SQL'
UPDATE users
SET
  role = 'CREATOR',
  updated_at = NOW()
WHERE lower(email) = lower(:'email');

SELECT email, role
FROM users
WHERE lower(email) = lower(:'email');
SQL