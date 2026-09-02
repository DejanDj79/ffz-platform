#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

[[ -f "$ENV_FILE" ]] || {
  echo "$ENV_FILE does not exist." >&2
  exit 1
}

if ! find drizzle-production -type f -name '*.sql' -print -quit 2>/dev/null \
    | grep -q .; then
  echo "No production migrations found in drizzle-production/." >&2
  echo "Run ./scripts/create-production-baseline.sh first." >&2
  exit 1
fi

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d postgres

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile ops \
  run --rm migrate

echo
echo "Production migrations complete."
