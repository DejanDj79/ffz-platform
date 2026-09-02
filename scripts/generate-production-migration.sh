#!/usr/bin/env bash
set -euo pipefail

NAME="${1:-}"

if [[ -z "$NAME" ]]; then
  echo "Usage: ./scripts/generate-production-migration.sh short_migration_name" >&2
  exit 1
fi

if ! find drizzle-production -type f -name '*.sql' -print -quit 2>/dev/null \
    | grep -q .; then
  echo "Production baseline is missing." >&2
  echo "Run ./scripts/create-production-baseline.sh first." >&2
  exit 1
fi

./node_modules/.bin/drizzle-kit \
  generate \
  --config=drizzle.production.config.ts \
  --name="$NAME"

echo
echo "Migration generated. Inspect the SQL before committing it."
