#!/usr/bin/env bash
set -euo pipefail

# Fail-closed D1 forward migration runner.
# Because D1 has no verified applied-migrations ledger table yet, and historical
# table-rebuild migrations (20260710_02_notifications_fixed.sql,
# 20261003_02_admin_metrics_and_inventory.sql) overwrite live columns when re-run,
# this script NEVER loops over all *.sql files. Every invocation must explicitly
# name the target forward migration file(s) via --file <migration.sql>.

DB_NAME="fnb-caffe-db"   # matches [[d1_databases]] in wrangler.toml
WRANGLER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="${WRANGLER_DIR}/db/migrations"

usage() {
  cat <<EOF >&2
Usage: bash worker/scripts/apply-migrations.sh --file <migration.sql> [--file <migration2.sql> ...]

Fail-closed D1 migration runner. Bulk replay of all historical migrations is disabled
until a live-verified D1 migration ledger is established.

Options:
  --file <name.sql>       Explicit forward migration filename in worker/db/migrations/
  --migration <name.sql>  Alias for --file
  --remote                Execute against remote D1 (default; still requires --file)
  --help, -h              Show this usage message
EOF
}

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo "ERROR: migrations directory not found: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

SELECTED_FILES=()
DRY_RUN=0

normalize_and_validate_target() {
  local raw_target="$1"
  if [[ -z "${raw_target}" ]]; then
    echo "ERROR: Empty migration filename passed to --file." >&2
    exit 1
  fi
  if [[ "${raw_target}" == *"*"* || "${raw_target}" == *"?"* || "${raw_target}" == *"["* ]]; then
    echo "ERROR: Wildcard/glob migration selection is forbidden (fail-closed): ${raw_target}" >&2
    exit 1
  fi
  if [[ "${raw_target}" == *".."* ]]; then
    echo "ERROR: Path traversal is forbidden in migration selection: ${raw_target}" >&2
    exit 1
  fi

  local normalized="${raw_target#./}"
  if [[ "${normalized}" == worker/db/migrations/* ]]; then
    normalized="${normalized#worker/db/migrations/}"
  elif [[ "${normalized}" == db/migrations/* ]]; then
    normalized="${normalized#db/migrations/}"
  fi

  if [[ "${normalized}" == *"/"* ]]; then
    echo "ERROR: Migration file must reside directly in worker/db/migrations/: ${raw_target}" >&2
    exit 1
  fi
  if [[ "${normalized}" == *.down.sql ]]; then
    echo "ERROR: Refusing to apply rollback migration (.down.sql) in forward runner: ${normalized}" >&2
    exit 1
  fi
  if [[ "${normalized}" != *.sql ]]; then
    echo "ERROR: Migration file must end with .sql: ${normalized}" >&2
    exit 1
  fi
  if [[ ! "${normalized}" =~ ^[0-9]{8}_[0-9]{2}_[a-z0-9_]+\.sql$ ]]; then
    echo "ERROR: Invalid canonical migration filename format (expected YYYYMMDD_NN_slug.sql): ${normalized}" >&2
    exit 1
  fi
  if [[ "${normalized}" == "20260706_11_notifications_push_loyalty.sql" || "${normalized}" == "20260824_02_users_table.sql" ]]; then
    echo "ERROR: Refusing to apply superseded migration per worker/db/migrations/README.md: ${normalized}" >&2
    exit 1
  fi

  local resolved_path="${MIGRATIONS_DIR}/${normalized}"
  if [[ ! -f "${resolved_path}" ]]; then
    echo "ERROR: Migration file not found in ${MIGRATIONS_DIR}: ${normalized}" >&2
    exit 1
  fi

  local existing
  for existing in "${SELECTED_FILES[@]+"${SELECTED_FILES[@]}"}"; do
    if [[ "${existing}" == "${normalized}" ]]; then
      echo "ERROR: Duplicate migration file specified in single invocation (fail-closed): ${normalized}" >&2
      exit 1
    fi
  done

  SELECTED_FILES+=("${normalized}")
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --file|--migration)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: Missing filename argument after $1" >&2
        usage
        exit 1
      fi
      normalize_and_validate_target "$2"
      shift 2
      ;;
    --file=*|--migration=*)
      normalize_and_validate_target "${1#*=}"
      shift
      ;;
    --remote)
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --all)
      echo "ERROR: Bulk historical migration replay (--all) is forbidden (fail-closed)." >&2
      usage
      exit 1
      ;;
    *)
      echo "ERROR: Unknown or unscoped argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ${#SELECTED_FILES[@]} -eq 0 ]]; then
  echo "ERROR: Fail-closed guard triggered — no explicit migration file specified." >&2
  echo "Refusing to replay all historical migrations in ${MIGRATIONS_DIR} without a verified D1 migration ledger." >&2
  usage
  exit 1
fi

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "DRY-RUN: Validated ${#SELECTED_FILES[@]} forward migration(s) in ${MIGRATIONS_DIR}:"
  for name in "${SELECTED_FILES[@]}"; do
    echo "  ✓ ${name}"
  done
  exit 0
fi

WRANGLER_CMD=(wrangler)
if ! command -v wrangler >/dev/null 2>&1; then
  WRANGLER_CMD=(npx wrangler)
fi

if ! "${WRANGLER_CMD[@]}" whoami >/dev/null 2>&1; then
  echo "ERROR: wrangler not authenticated. Run 'wrangler login' first." >&2
  exit 1
fi

echo "Applying ${#SELECTED_FILES[@]} explicitly selected D1 migration(s) from: ${MIGRATIONS_DIR}"
echo "Target DB: ${DB_NAME} (remote)"
echo "---"

SUCCESS_COUNT=0
FAIL_COUNT=0

pushd "${WRANGLER_DIR}" >/dev/null

for name in "${SELECTED_FILES[@]}"; do
  sql_file="${MIGRATIONS_DIR}/${name}"
  echo "Executing: ${name}"
  set +e
  output="$("${WRANGLER_CMD[@]}" d1 execute "${DB_NAME}" \
       --remote \
       --file "${sql_file}" \
       --yes 2>&1)"
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    echo "  ✓ ${name}"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "  ✗ ${name} FAILED" >&2
    echo "$output" | tail -10 >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

popd >/dev/null

echo "---"
echo "Done. ${SUCCESS_COUNT} succeeded, ${FAIL_COUNT} failed."
[ "${FAIL_COUNT}" -eq 0 ] || exit 1
