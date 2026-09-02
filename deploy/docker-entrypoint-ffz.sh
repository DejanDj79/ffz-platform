#!/bin/sh
set -eu

UPLOAD_DIR="${FFZ_UPLOAD_DIR:-/app/data/uploads}"

mkdir -p "$UPLOAD_DIR"
chown -R node:node "$UPLOAD_DIR"

exec su-exec node:node "$@"
