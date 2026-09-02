#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
ENV_FILE="${2:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -n "$BACKUP_DIR" ]] \
  || fail "Usage: RESTORE_FFZ_PRODUCTION=YES ./scripts/restore-production.sh backups/<timestamp> [.env.production]"

[[ "${RESTORE_FFZ_PRODUCTION:-}" == "YES" ]] \
  || fail "Set RESTORE_FFZ_PRODUCTION=YES to confirm destructive restore."

[[ -d "$BACKUP_DIR" ]] \
  || fail "Backup directory not found: $BACKUP_DIR"

[[ -f "$BACKUP_DIR/database.dump" ]] \
  || fail "database.dump is missing."

[[ -f "$BACKUP_DIR/uploads.tar.gz" ]] \
  || fail "uploads.tar.gz is missing."

[[ -f "$BACKUP_DIR/SHA256SUMS" ]] \
  || fail "SHA256SUMS is missing."

[[ -f "$ENV_FILE" ]] \
  || fail "$ENV_FILE does not exist."

(
  cd "$BACKUP_DIR"
  sha256sum -c SHA256SUMS
)

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo
echo "Stopping application traffic..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  stop nginx app >/dev/null 2>&1 || true

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d postgres

echo "Restoring PostgreSQL..."
cat "$BACKUP_DIR/database.dump" \
  | docker compose \
      --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" \
      exec -T postgres \
      pg_restore \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges

echo "Restoring Journal screenshots..."
cat "$BACKUP_DIR/uploads.tar.gz" \
  | docker compose \
      --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" \
      --profile ops \
      run --rm -T backup-helper \
      sh -c '
        find /uploads -mindepth 1 -maxdepth 1 -exec rm -rf {} +;
        tar -xzf - -C /uploads
      '

echo "Verifying schema..."
./scripts/verify-production-schema.sh "$ENV_FILE"

echo "Starting application..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d app nginx

echo
echo "Restore complete."
echo "Run:"
echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE ps"
