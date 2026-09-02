#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"

docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.production.yml \
  up -d --build postgres app nginx

docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.production.yml \
  ps
