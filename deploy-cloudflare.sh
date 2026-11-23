#!/usr/bin/env bash
set -euo pipefail

# F&B Caffe Container — Cloudflare Deploy Script
# Usage: bash deploy-cloudflare.sh [--worker-only | --pages-only] [--skip-tests] [--skip-git-check]
#                                  [--skip-migrations] [--migration-file=<name.sql>] [--skip-verify]
#                                  [--backup-d1] [--verify-d1-schema] [--allow-diverged-branch]
#
# Normal deploys NEVER auto-run historical D1 migrations (fail-closed against
# destructive table-rebuild replay when no verified D1 migration ledger exists).
# To apply a specific forward migration during deploy, pass --migration-file=<name.sql>.
#
# Unless --skip-tests is passed, the pre-deploy gate runs the full quality suite
# (lint, lint:migrations, check:contrast, typecheck:all, unit tests, payment loop).
# Unless --skip-git-check is passed, a clean working tree and a branch that
# contains origin/main are required, so a deploy cannot ship a stale or
# diverged commit. D1 migrations always run before the Worker and Pages deploys.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WORKER_DIR="worker"
DIST_DIR="dist"
MIGRATIONS_DIR="worker/db/migrations"

# Make worker-local binaries (e.g. wrangler) discoverable from repo root without
# shadowing earlier PATH entries used by system installs or test harnesses.
if [[ -d "${SCRIPT_DIR}/${WORKER_DIR}/node_modules/.bin" ]]; then
  export PATH="${PATH}:${SCRIPT_DIR}/${WORKER_DIR}/node_modules/.bin"
fi

WORKER_ONLY=false
PAGES_ONLY=false
SKIP_TESTS=false
SKIP_GIT_CHECK=false
SKIP_MIGRATIONS=false
SKIP_VERIFY=false
BACKUP_D1=false
VERIFY_D1_SCHEMA=false
ALLOW_DIVERGED_BRANCH=false
REQUESTED_BULK_MIGRATIONS=false
MIGRATION_FILES=()

validate_migration_target() {
  local raw_target="$1"
  if [[ -z "${raw_target}" ]]; then
    echo "ERROR: Empty migration filename passed to --migration-file." >&2
    exit 1
  fi
  if [[ "${raw_target}" == *"*"* || "${raw_target}" == *"?"* || "${raw_target}" == *"["* ]]; then
    echo "ERROR: Wildcard/glob migration selection is forbidden (fail-closed): ${raw_target}" >&2
    exit 1
  fi
  if [[ "${raw_target}" == *".."* ]]; then
    echo "ERROR: Path traversal is forbidden in --migration-file: ${raw_target}" >&2
    exit 1
  fi

  local normalized="${raw_target#./}"
  if [[ "${normalized}" == worker/db/migrations/* ]]; then
    normalized="${normalized#worker/db/migrations/}"
  elif [[ "${normalized}" == db/migrations/* ]]; then
    normalized="${normalized#db/migrations/}"
  fi

  if [[ "${normalized}" == *"/"* ]]; then
    echo "ERROR: Migration file must reside directly in ${MIGRATIONS_DIR}/: ${raw_target}" >&2
    exit 1
  fi
  if [[ "${normalized}" == *.down.sql ]]; then
    echo "ERROR: Refusing to apply rollback migration (.down.sql) during forward deploy: ${normalized}" >&2
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
  if [[ ! -f "${MIGRATIONS_DIR}/${normalized}" ]]; then
    echo "ERROR: Migration file not found in ${MIGRATIONS_DIR}: ${normalized}" >&2
    exit 1
  fi

  local existing
  for existing in "${MIGRATION_FILES[@]+"${MIGRATION_FILES[@]}"}"; do
    if [[ "${existing}" == "${normalized}" ]]; then
      echo "ERROR: Duplicate migration file specified in single invocation (fail-closed): ${normalized}" >&2
      exit 1
    fi
  done

  MIGRATION_FILES+=("${normalized}")
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --worker-only)
      WORKER_ONLY=true
      shift
      ;;
    --pages-only)
      PAGES_ONLY=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --skip-git-check)
      SKIP_GIT_CHECK=true
      shift
      ;;
    --allow-diverged-branch)
      ALLOW_DIVERGED_BRANCH=true
      shift
      ;;
    --backup-d1)
      BACKUP_D1=true
      shift
      ;;
    --verify-d1-schema)
      VERIFY_D1_SCHEMA=true
      shift
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS=true
      shift
      ;;
    --skip-verify)
      SKIP_VERIFY=true
      shift
      ;;
    --migration-file)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: Missing filename argument after --migration-file" >&2
        exit 1
      fi
      validate_migration_target "$2"
      shift 2
      ;;
    --migration-file=*)
      validate_migration_target "${1#*=}"
      shift
      ;;
    --apply-migrations|--run-migrations|--all-migrations)
      REQUESTED_BULK_MIGRATIONS=true
      shift
      ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$WORKER_ONLY" == "true" && "$PAGES_ONLY" == "true" ]]; then
  echo "ERROR: Cannot combine --worker-only and --pages-only." >&2
  exit 1
fi

if [[ "$REQUESTED_BULK_MIGRATIONS" == "true" && ${#MIGRATION_FILES[@]} -eq 0 ]]; then
  echo "ERROR: Fail-closed guard — refusing bulk historical D1 migration execution without explicit --migration-file=<name.sql>." >&2
  exit 1
fi

if [[ "$SKIP_MIGRATIONS" == "true" && ${#MIGRATION_FILES[@]} -gt 0 ]]; then
  echo "ERROR: Cannot combine --skip-migrations with --migration-file." >&2
  exit 1
fi

echo "=== F&B Caffe Container — Deploy ==="

# ── 0. Git hygiene gate ────────────────────────────────────────────────────
# Runs only inside a real git checkout; the offline deploy simulation harness
# copies this script into a bare temp directory and must still execute.
if [[ -e "${SCRIPT_DIR}/.git" && "$SKIP_GIT_CHECK" == "false" ]]; then
  echo "[0/5] Git pre-flight checks..."

  if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: Working tree has uncommitted changes. Commit them before deploying so the live version matches a real commit." >&2
    git status --short | head -20 >&2
    exit 1
  fi

  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "  Branch: ${CURRENT_BRANCH}"

  if git rev-parse --verify --quiet origin/main >/dev/null; then
    if ! git merge-base --is-ancestor origin/main HEAD; then
      if [[ "$ALLOW_DIVERGED_BRANCH" == "true" ]]; then
        echo "  WARNING: Branch does not contain origin/main (--allow-diverged-branch)."
      else
        echo "ERROR: Branch '${CURRENT_BRANCH}' does not contain origin/main. Merge or rebase origin/main first so the pull request stays mergeable." >&2
        echo "       Override intentionally with --allow-diverged-branch." >&2
        exit 1
      fi
    else
      echo "  origin/main is contained in HEAD"
    fi
  else
    echo "  origin/main not fetched; skipping ancestry check (run 'git fetch origin main' to enable it)"
  fi

  if git rev-parse --verify --quiet "origin/${CURRENT_BRANCH}" >/dev/null; then
    if [[ "$(git rev-parse "origin/${CURRENT_BRANCH}")" != "$(git rev-parse HEAD)" ]]; then
      if [[ "$ALLOW_DIVERGED_BRANCH" == "true" ]]; then
        echo "  WARNING: Local HEAD is not pushed to origin/${CURRENT_BRANCH} (--allow-diverged-branch)."
      else
        echo "ERROR: HEAD is not pushed to origin/${CURRENT_BRANCH}. Push first, otherwise the deployed commit is not reproducible from the remote." >&2
        echo "       Override intentionally with --allow-diverged-branch." >&2
        exit 1
      fi
    else
      echo "  HEAD matches origin/${CURRENT_BRANCH}"
    fi
  else
    echo "  origin/${CURRENT_BRANCH} not found; skipping push-parity check"
  fi
else
  echo "[0/5] Skipping git pre-flight checks (--skip-git-check or not a git checkout)"
fi

if [[ "$SKIP_TESTS" == "false" ]]; then
  echo "[1/5] Running quality gates..."

  echo "  typecheck:all"
  npm run typecheck:all 2>&1 | tail -5

  echo "  lint"
  npm run lint 2>&1 | tail -10

  echo "  lint:migrations"
  npm run lint:migrations 2>&1 | tail -5

  echo "  check:contrast"
  npm run check:contrast 2>&1 | tail -5

  echo "  test"
  npm test 2>&1 | tail -20

  echo "  payment flow (api-only)"
  node scripts/local-payment-flow/run.mjs --api-only 2>&1 | tail -10

  echo "Quality gates passed."
else
  echo "[1/5] Skipping quality gates (--skip-tests flag)"
fi

# ── 2. D1 Migrations (before Worker/Pages so live columns exist) ───────────
# Fail-closed: only explicit --migration-file targets are ever applied.
if [[ ${#MIGRATION_FILES[@]} -gt 0 ]]; then
  echo "[2/5] Applying ${#MIGRATION_FILES[@]} D1 migration(s) before code deploy..."

  if [[ "$BACKUP_D1" == "true" ]]; then
    BACKUP_DIR="${SCRIPT_DIR}/backups"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="${BACKUP_DIR}/d1-$(date -u +%Y%m%dT%H%M%SZ).sql"
    echo "  Exporting remote D1 snapshot to ${BACKUP_FILE}"
    npx --no-install wrangler d1 export fnb-caffe-db --remote --output "$BACKUP_FILE" 2>&1 | tail -5
  fi

  APPLY_ARGS=()
  for migration_name in "${MIGRATION_FILES[@]}"; do
    APPLY_ARGS+=(--file "$migration_name")
  done
  bash "$WORKER_DIR/scripts/apply-migrations.sh" "${APPLY_ARGS[@]}"

  if [[ "$VERIFY_D1_SCHEMA" == "true" ]]; then
    echo "  Verifying remote schema: orders.loyalty_points_redeemed"
    SCHEMA_DUMP="$(npx --no-install wrangler d1 execute fnb-caffe-db --remote \
      --command "PRAGMA table_info(orders);" --json 2>/dev/null || echo '[]')"
    if [[ "$SCHEMA_DUMP" != *"loyalty_points_redeemed"* ]]; then
      echo "ERROR: Remote D1 schema is missing orders.loyalty_points_redeemed after migration." >&2
      exit 1
    fi
    echo "  Remote schema verified"
  fi

  echo "  Migrations complete."
else
  echo "[2/5] Skipping D1 migrations (fail-closed default: pass --migration-file=<name.sql> to apply one)"
fi

# ── 3/5 Frontend Build + Pages Deploy ───────────────────────────────────────
if [[ "$WORKER_ONLY" == "false" ]]; then
  echo "[3/5] Building frontend with Vite..."
  npx --no-install vite build --mode production 2>&1 | tail -5

  echo "Copying static SEO and signage assets to dist..."
  cp robots.txt sitemap.xml dist/ 2>/dev/null || true
  mkdir -p dist/signage && cp -r signage-widgets/*.html dist/signage/ 2>/dev/null || true

  # ── Cache-busting: generate version.json that Cloudflare sees as a new file ──
  GIT_COMMIT_SHA_FULL=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  GIT_COMMIT_SHORT=$(echo "$GIT_COMMIT_SHA_FULL" | cut -c1-8)
  BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  cat > dist/version.json << VERSIONEOF
{
  "sha": "$GIT_COMMIT_SHA_FULL",
  "shortSha": "$GIT_COMMIT_SHORT",
  "buildTime": "$BUILD_TIMESTAMP",
  "deployScript": "deploy-cloudflare.sh"
}
VERSIONEOF
  echo "Cache-busting version.json written: $GIT_COMMIT_SHORT @ $BUILD_TIMESTAMP"

  echo "[4/5] Deploying to Cloudflare Pages..."
  npx --no-install wrangler pages deploy "$DIST_DIR" \
    --project-name=fnb-caffe-container \
    --branch=main \
    2>&1 | tail -5
fi

# ── 4/5 Worker Deploy (migrations already applied above) ────────────────────
if [[ "$PAGES_ONLY" == "false" ]]; then
  echo "[4/5] Deploying Cloudflare Worker..."
  WORKER_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  cd "$WORKER_DIR"
  npx --no-install wrangler deploy --config wrangler.toml --var GIT_COMMIT_SHA:"$WORKER_SHA" 2>&1 | tail -5
  cd ..
fi

# ── 5/5 Post-deploy verification ──────────────────────────────────────────
if [[ "$SKIP_VERIFY" == "false" ]]; then
  WORKER_URL="${DEPLOY_HEALTH_URL:-https://aura-space-worker.sadec-marketing-hub.workers.dev}"
  PAGES_DOMAIN="${DEPLOY_PAGES_URL:-https://auraspace.cafe}"
  LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
  MAX_RETRIES=3
  RETRY_DELAY=5

  echo ""
  echo "--- Post-deploy Verification ---"

  if [[ "$PAGES_ONLY" == "false" ]]; then
    echo "Worker URL: $WORKER_URL"

    # Check 1: Health endpoint
    for i in $(seq 1 $MAX_RETRIES); do
      echo "[Verify $i/$MAX_RETRIES] Checking /api/health..."
      HEALTH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$WORKER_URL/api/health" 2>/dev/null || echo "000")
      if [[ "$HEALTH_STATUS" == "200" ]]; then
        echo "  Health: OK (HTTP $HEALTH_STATUS)"
        break
      fi
      if [[ $i -lt $MAX_RETRIES ]]; then
        echo "  Health: Got HTTP $HEALTH_STATUS, retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
      else
        echo "  Health: FAILED after $MAX_RETRIES attempts (HTTP $HEALTH_STATUS)"
        echo "ERROR: Health endpoint not healthy. Deploy may have failed."
        exit 1
      fi
    done

    # Check 2: Version SHA match (worker)
    for i in $(seq 1 $MAX_RETRIES); do
      echo "[Verify $i/$MAX_RETRIES] Checking /api/version SHA match..."
      VERSION_JSON=$(curl -s --max-time 5 "$WORKER_URL/api/version" 2>/dev/null || echo '{}')
      LIVE_SHA=$(echo "$VERSION_JSON" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "MISSING")

      if [[ "$LIVE_SHA" == "$LOCAL_SHA" ]]; then
        echo "  SHA Match: $LIVE_SHA == $LOCAL_SHA"
        break
      fi
      if [[ $i -lt $MAX_RETRIES ]]; then
        echo "  SHA Mismatch: live=$LIVE_SHA local=$LOCAL_SHA, retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
      else
        echo "  SHA MISMATCH after $MAX_RETRIES attempts: live=$LIVE_SHA local=$LOCAL_SHA"
        echo "ERROR: Deployed version does not match local commit. Deploy may not have propagated."
        exit 1
      fi
    done
  fi

  if [[ "$WORKER_ONLY" == "false" ]]; then
    # Check 3: Custom domain (auraspace.cafe) version match
    echo ""
    echo "[Verify] Checking custom domain $PAGES_DOMAIN/version.json..."
    for i in $(seq 1 $MAX_RETRIES); do
      echo "[Verify $i/$MAX_RETRIES] ..."
      PAGES_VERSION_JSON=$(curl -s --max-time 5 "$PAGES_DOMAIN/version.json" 2>/dev/null || echo '{}')
      PAGES_SHA=$(echo "$PAGES_VERSION_JSON" | grep -o '"shortSha"[^,]*' | cut -d'"' -f4 || echo "MISSING")
      PAGES_HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$PAGES_DOMAIN/version.json" 2>/dev/null || echo "000")

      if [[ "$PAGES_SHA" == "$LOCAL_SHA" ]]; then
        echo "  Custom domain SHA Match: $PAGES_SHA == $LOCAL_SHA (HTTP $PAGES_HTTP)"
        break
      fi
      if [[ $i -lt $MAX_RETRIES ]]; then
        echo "  Custom domain SHA Mismatch: pages=$PAGES_SHA local=$LOCAL_SHA, retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
      else
        echo "  Custom domain SHA DISCREPANCY after $MAX_RETRIES attempts: pages=$PAGES_SHA local=$LOCAL_SHA (HTTP $PAGES_HTTP)"
        echo "ERROR: Custom domain version does not match local commit. Run 'bash scripts/deploy-fix.sh' or investigate caching."
        exit 1
      fi
    done
  fi

  echo "--- Verification PASSED ---"
else
  echo "Skipping post-deploy verification (--skip-verify flag)"
fi

echo "=== Deploy complete ==="
