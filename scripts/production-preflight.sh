#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] \
  || fail "$ENV_FILE does not exist."

command -v docker >/dev/null 2>&1 \
  || fail "Docker is not installed."

docker compose version >/dev/null 2>&1 \
  || fail "Docker Compose v2 is not available."

if ! find drizzle-production -type f -name '*.sql' -print -quit 2>/dev/null \
    | grep -q .; then
  fail "drizzle-production baseline is missing. Run ./scripts/create-production-baseline.sh first."
fi

grep -q '^FFZ_DOMAIN=' "$ENV_FILE" \
  || fail "FFZ_DOMAIN is missing."

grep -q '^POSTGRES_PASSWORD=' "$ENV_FILE" \
  || fail "POSTGRES_PASSWORD is missing."

grep -q '^AUTH_RATE_LIMIT_SALT=' "$ENV_FILE" \
  || fail "AUTH_RATE_LIMIT_SALT is missing."

DB_PASSWORD="$(
  sed -n 's/^POSTGRES_PASSWORD=//p' "$ENV_FILE" | head -n1
)"

RATE_SALT="$(
  sed -n 's/^AUTH_RATE_LIMIT_SALT=//p' "$ENV_FILE" | head -n1
)"

[[ "${#DB_PASSWORD}" -ge 32 ]] \
  || fail "POSTGRES_PASSWORD must be at least 32 characters."

[[ "${#RATE_SALT}" -ge 32 ]] \
  || fail "AUTH_RATE_LIMIT_SALT must be at least 32 characters."

echo "1/7 Compose configuration..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  config >/dev/null

echo "2/7 Building FFZ application + migration image..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile ops \
  build app migrate

echo "3/7 Starting PostgreSQL..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d postgres

echo "4/7 Applying production migrations..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile ops \
  run --rm migrate

echo "5/7 Verifying schema..."
./scripts/verify-production-schema.sh "$ENV_FILE"

echo "6/7 Starting application..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d app

echo "7/7 Waiting for application readiness..."

for attempt in $(seq 1 30); do
  if docker compose \
      --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" \
      exec -T app \
      node -e \
      "fetch('http://127.0.0.1:3000/api/health/ready').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)}).catch(()=>process.exit(1))" \
      >/tmp/ffz-ready.out 2>/dev/null; then

    cat /tmp/ffz-ready.out
    rm -f /tmp/ffz-ready.out

    echo
    echo "Production container + migration preflight PASSED."
    echo
    docker compose \
      --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" \
      ps
    exit 0
  fi

  sleep 2
done

echo
echo "Application did not become ready."

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  ps

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  logs --tail=150 app postgres

exit 1
