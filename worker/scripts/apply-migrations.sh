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
  --resume-existing       Verify schema and import only missing approved DDL (Node 22.13+)
  --dry-run               Validate selection offline; do not inspect D1
  --help, -h              Show this usage message
EOF
}

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo "ERROR: migrations directory not found: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

SELECTED_FILES=()
DRY_RUN=0
RESUME_EXISTING=0

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
    --resume-existing)
      RESUME_EXISTING=1
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

if [[ "${RESUME_EXISTING}" -eq 1 ]]; then
  RESUME_HELPER="${WRANGLER_DIR}/scripts/prepare-migration-resume.mjs"
  resume_sources=()
  for name in "${SELECTED_FILES[@]}"; do
    resume_sources+=("${MIGRATIONS_DIR}/${name}")
  done
  node "${RESUME_HELPER}" --check "${resume_sources[@]}" || exit 1
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

if [[ "${RESUME_EXISTING}" -eq 1 ]]; then
  resume_dir="$(mktemp -d "${TMPDIR:-/tmp}/aura-migration-resume.XXXXXXXX")"
  trap 'rm -rf -- "${resume_dir}"' EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
fi

for name in "${SELECTED_FILES[@]}"; do
  sql_file="${MIGRATIONS_DIR}/${name}"
  if [[ "${RESUME_EXISTING}" -eq 1 ]]; then
    query="$(node "${RESUME_HELPER}" --query "${sql_file}")" || exit 1
    if ! "${WRANGLER_CMD[@]}" d1 execute "${DB_NAME}" --remote --json --command "${query}" > "${resume_dir}/schema.json"; then
      echo "ERROR: Failed to query D1 schema for ${name}; stopping." >&2
      exit 1
    fi
    residual="${resume_dir}/${name}"
    node "${RESUME_HELPER}" --prepare "${sql_file}" "${resume_dir}/schema.json" "${residual}" || exit 1
    if [[ ! -s "${residual}" ]]; then
      echo "  ✓ ${name}: verified no-op (schema already matches)"
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
      continue
    fi
    sql_file="${residual}"
  fi
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
    echo "Stopping remaining migrations after failure in ${name}." >&2
    break
  fi
done

popd >/dev/null

echo "---"
echo "Done. ${SUCCESS_COUNT} succeeded, ${FAIL_COUNT} failed."
[ "${FAIL_COUNT}" -eq 0 ] || exit 1
