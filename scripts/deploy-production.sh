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

if ! find drizzle-production -type f -name '*.sql' -print -quit 2>/dev/null \
    | grep -q .; then
  fail "Production migrations are missing."
fi

echo "Building application and migration images..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile ops \
  build app migrate

echo "Starting PostgreSQL..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d postgres

# Prevent old application code from writing during schema changes.
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  stop nginx app >/dev/null 2>&1 || true

echo "Applying migrations..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile ops \
  run --rm migrate

./scripts/verify-production-schema.sh "$ENV_FILE"

echo "Starting FFZ app + Nginx..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d app nginx

echo "Waiting for readiness..."
for attempt in $(seq 1 40); do
  if docker compose \
      --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" \
      exec -T app \
      node -e \
      "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then

    echo
    echo "FFZ production deployment is READY."
    docker compose \
      --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" \
      ps
    exit 0
  fi

  sleep 3
done

echo "Deployment failed readiness check." >&2
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  logs --tail=150 app nginx postgres
exit 1
