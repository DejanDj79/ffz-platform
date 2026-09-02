#!/usr/bin/env bash
set -euo pipefail

EMAIL="${1:-}"
ENV_FILE="${2:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

[[ -n "$EMAIL" ]] || {
  echo "Usage: ./scripts/promote-creator.sh you@example.com [.env.production]" >&2
  exit 1
}

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

normalized="$(
  printf '%s' "$EMAIL" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
)"

affected="$(
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    exec -T postgres \
    psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -At \
    -v email="$normalized" \
    -c "
      WITH changed AS (
        UPDATE users
        SET role = 'CREATOR',
            updated_at = NOW()
        WHERE lower(email) = lower(:'email')
        RETURNING id
      )
      SELECT count(*) FROM changed;
    "
)"

if [[ "$affected" != "1" ]]; then
  echo "No unique registered user found for: $normalized" >&2
  exit 1
fi

echo "Creator role enabled for: $normalized"
