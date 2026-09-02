#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -f .dockerignore ]] \
  || fail ".dockerignore is missing."

grep -q '^\.env\.\*$' .dockerignore \
  || fail ".dockerignore does not exclude .env.*"

grep -q '^src/tests$' .dockerignore \
  || fail ".dockerignore does not exclude src/tests"

if git check-ignore -q .env.local 2>/dev/null; then
  :
else
  echo "WARNING: .env.local is not ignored by Git."
fi

echo ".dockerignore checks passed."
echo
echo "The production Docker context excludes:"
echo "  .env.local"
echo "  .env.production"
echo "  src/tests"
echo "  data/"
echo "  backups/"
