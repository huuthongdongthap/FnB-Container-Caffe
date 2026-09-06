#!/usr/bin/env bash
# F&B Caffe Container — Production Deploy Script
# Usage: bash scripts/deploy.sh [--skip-tests] [--skip-smoke]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_DIR="$SCRIPT_DIR/.."
cd "$WORKER_DIR"

SKIP_TESTS=false
SKIP_SMOKE=false

for arg in "$@"; do
  case $arg in
    --skip-tests) SKIP_TESTS=true ;;
    --skip-smoke) SKIP_SMOKE=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

WORKER_URL="https://api.auraspace.cafe"
PAGES_URL="https://auraspace.cafe"

echo "========================================"
echo "  F&B Caffe Container — Deploy"
echo "========================================"
echo "Worker URL: $WORKER_URL"
echo "Pages URL:  $PAGES_URL"
echo ""

# ── 1. Preflight Checks ──────────────────────────────────────────────────────
echo "[1/6] Preflight Checks"

# Node + wrangler
command -v node >/dev/null || { echo "ERROR: node not found"; exit 1; }
command -v npx >/dev/null || { echo "ERROR: npx not found"; exit 1; }
npx wrangler --version >/dev/null || { echo "ERROR: wrangler not found"; exit 1; }

# Git clean
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "WARN: Working tree has uncommitted changes"
  git status --short
fi

# Commit SHA for version endpoint
GIT_SHA=$(git rev-parse --short HEAD)
echo "  Git SHA: $GIT_SHA"

# Required secrets check (presence only, no values)
echo "  Checking secret presence..."
SECRETS=("JWT_SECRET" "PAYOS_CLIENT_ID" "PAYOS_API_KEY" "PAYOS_CHECKSUM_KEY")
for s in "${SECRETS[@]}"; do
  npx wrangler secret list | grep -q "^$s$" || { echo "ERROR: Secret $s not set"; exit 1; }
  echo "    $s: ✓"
done

# Bindings check
echo "  Checking D1/KV/DO bindings..."
npx wrangler d1 list | grep -q "fnb-caffe-db" || { echo "ERROR: D1 fnb-caffe-db not found"; exit 1; }
echo "    D1: ✓"

echo "  Preflight: PASSED"

# ── 2. TypeCheck + Build ─────────────────────────────────────────────────────
echo "[2/6] TypeCheck + Build"
npx tsc --noEmit || { echo "FAIL: TypeScript errors"; exit 1; }
echo "  TypeCheck: PASSED"

# ── 3. Tests ─────────────────────────────────────────────────────────────────
if [[ "$SKIP_TESTS" == false ]]; then
  echo "[3/6] Unit/Integration Tests"
  npx vitest run || { echo "FAIL: Tests failed"; exit 1; }
  echo "  Tests: PASSED"
else
  echo "[3/6] Skipping tests (--skip-tests)"
fi

# ── 4. Deploy Worker ─────────────────────────────────────────────────────────
echo "[4/6] Deploy Worker"
DEPLOY_OUTPUT=$(npx wrangler deploy --minify 2>&1)
echo "$DEPLOY_OUTPUT"
DEPLOY_ID=$(echo "$DEPLOY_OUTPUT" | grep -o 'deployment-[a-z0-9-]*' | head -1 || echo "unknown")
echo "  Deployment ID: $DEPLOY_ID"

# ── 5. Health Check ──────────────────────────────────────────────────────────
echo "[5/6] Health Check"
MAX_RETRIES=10
RETRY_DELAY=3
HEALTH_OK=false

for i in $(seq 1 $MAX_RETRIES); do
  HEALTH_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$WORKER_URL/api/health?db=1" || echo "000")
  if [[ "$HEALTH_STATUS" == "200" ]]; then
    HEALTH_BODY=$(curl -sS "$WORKER_URL/api/health?db=1")
    echo "$HEALTH_BODY" | jq -e '.status == "healthy" or .status == "degraded"' >/dev/null && {
      echo "  Health: OK ($HEALTH_BODY)"
      HEALTH_OK=true
      break
    }
  fi
  echo "  Health check $i/$MAX_RETRIES: HTTP $HEALTH_STATUS (retrying in ${RETRY_DELAY}s...)"
  sleep $RETRY_DELAY
done

if [[ "$HEALTH_OK" == false ]]; then
  echo "ERROR: Health check failed after $MAX_RETRIES attempts"
  exit 1
fi

# ── 6. Smoke Tests ───────────────────────────────────────────────────────────
if [[ "$SKIP_SMOKE" == false ]]; then
  echo "[6/6] Post-Deploy Smoke Tests"
  bash scripts/smoke-production.sh "$WORKER_URL" || { echo "FAIL: Smoke tests failed"; exit 1; }
  echo "  Smoke: PASSED"
else
  echo "[6/6] Skipping smoke tests (--skip-smoke)"
fi

echo ""
echo "========================================"
echo "  DEPLOY SUCCESS"
echo "========================================"
echo "Worker:      $WORKER_URL"
echo "Pages:       $PAGES_URL"
echo "Deployment:  $DEPLOY_ID"
echo "Git SHA:     $GIT_SHA"
echo ""
echo "Next Steps:"
echo "  1. Verify admin panel: $PAGES_URL/admin"
echo "  2. Monitor alerts (Telegram) for 10 minutes"
echo "  3. Rollback if issues: bash scripts/deploy-rollback.sh $DEPLOY_ID"
echo ""
