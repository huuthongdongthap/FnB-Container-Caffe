#!/usr/bin/env bash
set -euo pipefail

# Apply all pending D1 migrations to the production (remote) database.
# Each .sql file is idempotent: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS.

DB_NAME="fnb-caffe-db"   # matches [[d1_databases]] in wrangler.toml
WRANGLER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="${WRANGLER_DIR}/db/migrations"

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo "ERROR: migrations directory not found: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

if ! wrangler whoami >/dev/null 2>&1; then
  echo "ERROR: wrangler not authenticated. Run 'wrangler login' first." >&2
  exit 1
fi

echo "Applying D1 migrations from: ${MIGRATIONS_DIR}"
echo "Target DB: ${DB_NAME} (remote)"
echo "---"

SUCCESS_COUNT=0
FAIL_COUNT=0

pushd "${WRANGLER_DIR}" >/dev/null

for sql_file in "${MIGRATIONS_DIR}"/*.sql; do
  [ -f "${sql_file}" ] || continue
  name="$(basename "${sql_file}")"
  echo "Executing: ${name}"
  if wrangler d1 execute "${DB_NAME}" \
       --remote \
       --file "${sql_file}" \
       --yes 2>&1; then
    echo "  ✓ ${name}"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "  ✗ ${name} FAILED" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

popd >/dev/null

echo "---"
echo "Done. ${SUCCESS_COUNT} succeeded, ${FAIL_COUNT} failed."
[ "${FAIL_COUNT}" -eq 0 ] || exit 1
