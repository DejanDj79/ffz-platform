#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="drizzle-production"
CONFIG="drizzle.production.config.ts"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -f "$CONFIG" ]] \
  || fail "$CONFIG is missing."

[[ -f src/db/schema.ts ]] \
  || fail "src/db/schema.ts is missing."

[[ -x node_modules/.bin/drizzle-kit ]] \
  || fail "drizzle-kit is not installed. Run npm install first."

if [[ -d "$OUT_DIR" ]] && find "$OUT_DIR" -type f | grep -q .; then
  fail "$OUT_DIR already contains files. Refusing to create a second baseline."
fi

rm -rf "$OUT_DIR"

echo "Generating clean production migration baseline from src/db/schema.ts..."
./node_modules/.bin/drizzle-kit \
  generate \
  --config="$CONFIG" \
  --name=production_baseline

SQL_COUNT="$(
  find "$OUT_DIR" -type f -name '*.sql' | wc -l | tr -d ' '
)"

[[ "$SQL_COUNT" -ge 1 ]] \
  || fail "Drizzle did not create a SQL migration."

for table in \
  users \
  sessions \
  trading_accounts \
  challenges \
  trades \
  trade_attachments \
  ledger_entries \
  scoreboard_settings \
  economic_calendar_cache
do
  if ! grep -R -E -q \
      "CREATE TABLE[[:space:]]+\"?${table}\"?" \
      "$OUT_DIR"; then
    fail "Baseline does not appear to create expected table: $table"
  fi
done

echo
echo "Production baseline generated successfully."
echo
find "$OUT_DIR" -maxdepth 3 -type f -print | sort
echo
echo "IMPORTANT:"
echo "  1. Inspect the generated SQL."
echo "  2. Run the production preflight."
echo "  3. Commit drizzle-production/ to Git."
