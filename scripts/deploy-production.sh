#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"
PROXY_NETWORK="${FFZ_PROXY_NETWORK:-agarviz_default}"

fail() { echo "ERROR: $*" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE does not exist."
docker network inspect "$PROXY_NETWORK" >/dev/null 2>&1 || fail "Required shared Docker network does not exist: $PROXY_NETWORK"
find drizzle-production -type f -name '*.sql' -print -quit 2>/dev/null | grep -q . || fail "Production migrations are missing."

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile ops build app migrate
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop app >/dev/null 2>&1 || true
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile ops run --rm migrate
./scripts/verify-production-schema.sh "$ENV_FILE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d app

for attempt in $(seq 1 40); do
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T app \
      node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
    echo "FFZ application is READY."
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
    exit 0
  fi
  sleep 3
done

echo "FFZ deployment failed readiness check." >&2
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=150 app postgres
exit 1
