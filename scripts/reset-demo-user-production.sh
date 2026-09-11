#!/usr/bin/env bash
set -euo pipefail

EMAIL="${1:-}"
MODE="${2:-}"
ENV_FILE="${FFZ_ENV_FILE:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

fail() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "$EMAIL" ]] || fail "Usage: $0 <demo-email> [--confirm]"
[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE does not exist."

ARGS=(--email "$EMAIL")

if [[ -n "$MODE" ]]; then
  [[ "$MODE" == "--confirm" ]] || fail "Second argument must be --confirm or omitted."
  ARGS+=(--confirm "$EMAIL")
fi

if [[ "$MODE" == "--confirm" ]]; then
  echo "About to RESET demo app data for: $EMAIL"
else
  echo "Dry-run demo reset for: $EMAIL"
fi

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile ops \
  run --rm --build demo-reset "${ARGS[@]}"
