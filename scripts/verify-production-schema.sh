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
  user_plans
  trading_accounts
  challenges
  trades
  trade_attachments
  ledger_entries
  scoreboard_settings
  economic_calendar_cache
  custom_rule_presets
  trading_guardrail_settings
  founder_slots
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

founder_slot_count="$(
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    exec -T postgres \
    psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -Atc "SELECT count(*) FROM public.founder_slots;"
)"

if [[ "$founder_slot_count" != "150" ]]; then
  echo "ERROR: founder_slots must contain exactly 150 rows; found $founder_slot_count." >&2
  exit 1
fi

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
