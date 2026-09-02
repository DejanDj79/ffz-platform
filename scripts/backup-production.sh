#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"
BACKUP_ROOT="${FFZ_BACKUP_DIR:-./backups}"
RETENTION_DAYS="${FFZ_BACKUP_RETENTION_DAYS:-14}"

[[ -f "$ENV_FILE" ]] || {
  echo "$ENV_FILE does not exist." >&2
  exit 1
}

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

STAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
DEST="${BACKUP_ROOT}/${STAMP}"

mkdir -p "$DEST"
chmod 700 "$DEST"

echo "Checking PostgreSQL..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d postgres >/dev/null

echo "Backing up PostgreSQL..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres \
  pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc \
  --no-owner \
  --no-privileges \
  > "${DEST}/database.dump"

echo "Backing up Journal screenshots..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile ops \
  run --rm -T backup-helper \
  sh -c "tar -czf - -C /uploads ." \
  > "${DEST}/uploads.tar.gz"

{
  echo "created_utc=${STAMP}"
  echo "hostname=$(hostname)"
  echo "git_commit=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "postgres_image=postgres:17-alpine"
} > "${DEST}/manifest.txt"

(
  cd "$DEST"
  sha256sum \
    database.dump \
    uploads.tar.gz \
    manifest.txt \
    > SHA256SUMS
)

chmod 600 "${DEST}/database.dump" "${DEST}/uploads.tar.gz"

echo
echo "Backup complete:"
echo "  ${DEST}"
echo
du -h "${DEST}/database.dump" "${DEST}/uploads.tar.gz"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  find "$BACKUP_ROOT" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -mtime "+${RETENTION_DAYS}" \
    -print \
    -exec rm -rf {} +
fi

echo
echo "NOTE: backups stored only on this server are not off-site disaster recovery."
