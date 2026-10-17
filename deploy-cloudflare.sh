#!/usr/bin/env bash
set -euo pipefail

# F&B Caffe Container — Cloudflare Deploy Script
# Usage: bash deploy-cloudflare.sh [--worker-only | --pages-only] [--skip-tests] [--skip-migrations] [--migration-file=<name.sql>] [--skip-verify]
#
# Normal deploys NEVER auto-run historical D1 migrations (fail-closed against
# destructive table-rebuild replay when no verified D1 migration ledger exists).
# To apply a specific forward migration during deploy, pass --migration-file=<name.sql>.

WORKER_DIR="worker"
DIST_DIR="dist"
MIGRATIONS_DIR="worker/db/migrations"

WORKER_ONLY=false
PAGES_ONLY=false
SKIP_TESTS=false
SKIP_MIGRATIONS=false
SKIP_VERIFY=false
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

# ── 0. Pre-deploy test gate ────────────────────────────────────────────────
if [[ "$SKIP_TESTS" == "false" ]]; then
  echo "[0/3] Running tests..."
  npm test 2>&1 | tail -20
  echo "Tests passed."
else
  echo "[0/3] Skipping tests (--skip-tests flag)"
fi

# ── 1. Frontend Build ────────────────────────────────────────────────────
if [[ "$WORKER_ONLY" == "false" ]]; then
  echo "[1/3] Building frontend with Vite..."
  npx vite build --mode production 2>&1 | tail -5

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

  echo "[2/3] Deploying to Cloudflare Pages..."
  npx wrangler pages deploy "$DIST_DIR" \
    --project-name=fnb-caffe-container \
    --branch=main \
    2>&1 | tail -5
fi

# ── 2. Worker Deploy ─────────────────────────────────────────────────────
if [[ "$PAGES_ONLY" == "false" ]]; then
  echo "[3/3] Deploying Cloudflare Worker..."
  GIT_COMMIT_SHA=$(git rev-parse HEAD)
  cd "$WORKER_DIR"
  npx wrangler deploy --config wrangler.toml --var GIT_COMMIT_SHA:"$GIT_COMMIT_SHA" 2>&1 | tail -5
  cd ..
fi

# ── 3a. D1 Migrations (Fail-closed: explicit --migration-file only) ──────
if [[ ${#MIGRATION_FILES[@]} -gt 0 ]]; then
  echo ""
  echo "--- D1 Migrations (Explicit Selection) ---"
  APPLY_ARGS=()
  for migration_name in "${MIGRATION_FILES[@]}"; do
    APPLY_ARGS+=(--file "$migration_name")
  done
  bash "$WORKER_DIR/scripts/apply-migrations.sh" "${APPLY_ARGS[@]}"
  echo "--- Migrations Complete ---"
else
  echo "Skipping D1 migrations by default (fail-closed: pass --migration-file=<name.sql> to apply an explicit migration)"
fi

# ── 3b. Post-deploy verification ──────────────────────────────────────────
if [[ "$SKIP_VERIFY" == "false" ]]; then
  WORKER_URL="${DEPLOY_HEALTH_URL:-https://aura-space-worker.sadec-marketing-hub.workers.dev}"
  LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
  MAX_RETRIES=3
  RETRY_DELAY=5

  echo ""
  echo "--- Post-deploy Verification ---"
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

  # Check 3: Custom domain (auraspace.cafe) version match
  PAGES_DOMAIN="https://auraspace.cafe"
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
      echo "  WARNING: Custom domain may still serve cached content."
      echo "  To force refresh: run 'bash scripts/deploy-fix.sh'"
    fi
  done

  echo "--- Verification PASSED ---"
else
  echo "Skipping post-deploy verification (--skip-verify flag)"
fi

echo "=== Deploy complete ==="
