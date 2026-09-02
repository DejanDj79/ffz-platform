#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

EXPECTED=(
  users
  sessions
  trading_accounts
  challenges
  trades
  trade_attachments
  ledger_entries
  scoreboard_settings
  economic_calendar_cache
)

for table in "${EXPECTED[@]}"; do
  result="$(
    docker compose \
      --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" \
      exec -T postgres \
      psql \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -Atc "SELECT to_regclass('public.${table}') IS NOT NULL;"
  )"

  if [[ "$result" != "t" ]]; then
    echo "ERROR: missing production table: $table" >&2
    exit 1
  fi
done

migration_table="$(
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    exec -T postgres \
    psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -Atc "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL;"
)"

[[ "$migration_table" == "t" ]] || {
  echo "ERROR: Drizzle migration log table is missing." >&2
  exit 1
}

echo "Production schema verification PASSED."
