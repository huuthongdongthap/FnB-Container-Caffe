#!/usr/bin/env bash
set -euo pipefail

# F&B Caffe Container — Cloudflare Deploy Script
# Usage: bash deploy-cloudflare.sh [--worker-only | --pages-only] [--skip-tests] [--skip-migrations] [--skip-verify]

WORKER_DIR="worker"
DIST_DIR="dist"

echo "=== F&B Caffe Container — Deploy ==="

# ── 0. Pre-deploy test gate ────────────────────────────────────────────────
if [[ "${1:-}" != "--skip-tests" && "${2:-}" != "--skip-tests" && "${3:-}" != "--skip-tests" ]]; then
  echo "[0/3] Running tests..."
  npm test 2>&1 | tail -20
  echo "Tests passed."
else
  echo "[0/3] Skipping tests (--skip-tests flag)"
fi

# ── 1. Frontend Build ────────────────────────────────────────────────────
if [[ "${1:-}" != "--worker-only" && "${2:-}" != "--worker-only" && "${3:-}" != "--worker-only" ]]; then
  echo "[1/3] Building frontend with Vite..."
  npx vite build --mode production 2>&1 | tail -5

  echo "Copying static assets and demos to dist..."
  cp -r assets dist/ 2>/dev/null || echo "No assets to copy"

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
if [[ "${1:-}" != "--pages-only" && "${2:-}" != "--pages-only" && "${3:-}" != "--pages-only" ]]; then
  echo "[3/3] Deploying Cloudflare Worker..."
  GIT_COMMIT_SHA=$(git rev-parse HEAD)
  cd "$WORKER_DIR"
  npx wrangler deploy --config wrangler.toml --var GIT_COMMIT_SHA:"$GIT_COMMIT_SHA" 2>&1 | tail -5
  cd ..
fi

# ── 3a. D1 Migration Auto-apply ──────────────────────────────────────────
if [[ "${1:-}" != "--skip-migrations" && "${2:-}" != "--skip-migrations" && "${3:-}" != "--skip-migrations" ]]; then
  MIGRATIONS_DIR="scripts/migrations"
  if [[ -d "$MIGRATIONS_DIR" ]] && [[ -n "$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null)" ]]; then
    echo ""
    echo "--- D1 Migrations ---"
    cd "$WORKER_DIR"

    for migration in ../"$MIGRATIONS_DIR"/*.sql; do
      migration_name=$(basename "$migration")
      echo "Applying: $migration_name"
      MIGRATION_OUTPUT=$(npx wrangler d1 execute fnb-caffe-db --file="$migration" --remote 2>&1)
      MIGRATION_EXIT=$?

      if [[ $MIGRATION_EXIT -ne 0 ]]; then
        echo "ERROR: Migration $migration_name failed:"
        echo "$MIGRATION_OUTPUT" | tail -10
        cd ..
        exit 1
      fi
      echo "  OK: $migration_name applied."
    done

    cd ..
    echo "--- Migrations Complete ---"
  else
    echo "No migration files found in $MIGRATIONS_DIR — skipping."
  fi
else
  echo "Skipping D1 migrations (--skip-migrations flag)"
fi

# ── 3b. Post-deploy verification ──────────────────────────────────────────
if [[ "${1:-}" != "--skip-verify" && "${2:-}" != "--skip-verify" && "${3:-}" != "--skip-verify" ]]; then
  WORKER_URL="${DEPLOY_HEALTH_URL:-https://aura-space-worker.agencyos-openclaw.workers.dev}"
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
    PAGES_SHA=$(echo "$PAGES_VERSION_JSON" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "MISSING")
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
