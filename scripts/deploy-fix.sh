#!/usr/bin/env bash
# deploy-fix.sh — Force custom domain to use latest deployment
#
# Fixes the "custom domain stuck on old deployment" problem by:
# 1. Deleting all but the last 3 Pages deployments (so Cloudflare serves fresh)
# 2. Rebuilding and deploying with cache-busting version.json
# 3. Verifying the custom domain serves the correct version
#
# Usage:
#   bash scripts/deploy-fix.sh [--skip-build] [--skip-cleanup]
#
# Options:
#   --skip-build    Skip vite build, deploy existing dist/ (use after a local build fix)
#   --skip-cleanup  Skip old deployment cleanup, just rebuild + deploy

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_NAME="fnb-caffe-container"
DIST_DIR="$PROJECT_DIR/dist"
BRANCH="main"
CUSTOM_DOMAIN="auraspace.cafe"
MAX_RETRIES=5
RETRY_DELAY=5
KEEP_LATEST=3

SKIP_BUILD=false
SKIP_CLEANUP=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    --skip-cleanup) SKIP_CLEANUP=true; shift ;;
    *) echo "ERROR: Unknown option: $1"; exit 1 ;;
  esac
done

echo ""
echo "============================================"
echo "  Deploy Fix — Force custom domain update"
echo "  Project:  $PROJECT_NAME"
echo "  Domain:   $CUSTOM_DOMAIN"
echo "  Branch:   $BRANCH"
echo "============================================"
echo ""

# ── Step 0: Prerequisites ─────────────────────────────────────────────────
if ! command -v wrangler &>/dev/null && ! npx --no-install wrangler --version &>/dev/null 2>&1; then
  echo "ERROR: wrangler not found. Install with: npm install -g wrangler"
  exit 1
fi

# ── Step 1: Clean up old deployments (keep only last N) ───────────────────
if [[ "$SKIP_CLEANUP" == "false" ]]; then
  echo "[1/3] Cleaning up old Cloudflare Pages deployments..."
  echo "  Keeping only the $KEEP_LATEST most recent deployments."

  # List deployments, parse JSON output, skip first KEEP_LATEST, delete rest
  DEPLOYMENTS_JSON=$(npx wrangler pages deployment list \
    --project-name="$PROJECT_NAME" --branch="$BRANCH" 2>/dev/null || echo "[]")

  # wrangler outputs a table, not JSON. Parse the table to get deployment IDs.
  # Format (headers vary by version, but we look for the id column):
  #   ──────────────────────────────────────────────
  #   ID  Created  Branch  Status
  #   abc123  ...    main   Success
  #   def456  ...    main   Success
  DEPLOY_IDS=$(echo "$DEPLOYMENTS_JSON" | awk '
    /^[a-f0-9]{8,}/ {
      ids[++count] = $1
    }
    END {
      # Keep last KEEP_LATEST, delete the rest
      keep = '$KEEP_LATEST'
      for (i = 1; i <= count - keep; i++) {
        print ids[i]
      }
    }
  ')

  DELETED_COUNT=0
  for DEPLOY_ID in $DEPLOY_IDS; do
    echo "  Deleting deployment $DEPLOY_ID..."
    npx wrangler pages deployment delete \
      --project-name="$PROJECT_NAME" "$DEPLOY_ID" 2>/dev/null && \
      DELETED_COUNT=$((DELETED_COUNT + 1)) || \
      echo "    WARNING: Could not delete $DEPLOY_ID (may be active)"
  done

  if [[ "$DELETED_COUNT" -eq 0 ]]; then
    echo "  No old deployments to clean up."
  else
    echo "  Deleted $DELETED_COUNT old deployment(s)."
  fi
else
  echo "[1/3] Skipping deployment cleanup (--skip-cleanup)"
fi

# ── Step 2: Build + Deploy ───────────────────────────────────────────────
cd "$PROJECT_DIR"

if [[ "$SKIP_BUILD" == "false" ]]; then
  echo ""
  echo "[2/3] Building frontend with Vite..."
  npx vite build --mode production 2>&1 | tail -5
else
  echo ""
  echo "[2/3] Skipping build (--skip-build), using existing dist/"
fi

# Generate cache-busting version.json
echo ""
echo "  Generating cache-busting version.json..."
GIT_COMMIT_SHA_FULL=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_COMMIT_SHORT=$(echo "$GIT_COMMIT_SHA_FULL" | cut -c1-8)
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p "$DIST_DIR"
cat > "$DIST_DIR/version.json" << VERSIONEOF
{
  "sha": "$GIT_COMMIT_SHA_FULL",
  "shortSha": "$GIT_COMMIT_SHORT",
  "buildTime": "$BUILD_TIMESTAMP",
  "deployScript": "deploy-fix.sh"
}
VERSIONEOF
echo "  version.json: $GIT_COMMIT_SHORT @ $BUILD_TIMESTAMP"

echo ""
echo "  Deploying to Cloudflare Pages (branch=$BRANCH)..."
npx wrangler pages deploy "$DIST_DIR" \
  --project-name="$PROJECT_NAME" \
  --branch="$BRANCH" 2>&1 | tail -5

# ── Step 3: Verify custom domain ─────────────────────────────────────────
echo ""
echo "[3/3] Verifying custom domain $CUSTOM_DOMAIN..."
echo "  Expected SHA: $GIT_COMMIT_SHORT"

VERIFIED=false
for i in $(seq 1 $MAX_RETRIES); do
  echo "  [Attempt $i/$MAX_RETRIES] Checking https://$CUSTOM_DOMAIN/version.json..."

  PAGES_VERSION_JSON=$(curl -s --max-time 5 "https://$CUSTOM_DOMAIN/version.json" 2>/dev/null || echo '{}')
  PAGES_SHA=$(echo "$PAGES_VERSION_JSON" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "MISSING")
  PAGES_HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$CUSTOM_DOMAIN/version.json" 2>/dev/null || echo "000")

  echo "    HTTP $PAGES_HTTP | SHA: $PAGES_SHA"

  if [[ "$PAGES_SHA" == "$GIT_COMMIT_SHORT" ]]; then
    echo "  SUCCESS: Custom domain is serving the correct version."
    VERIFIED=true
    break
  fi

  if [[ $i -lt $MAX_RETRIES ]]; then
    echo "  SHA mismatch or not propagated yet. Retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  fi
done

echo ""
echo "============================================"
if [[ "$VERIFIED" == "true" ]]; then
  echo "  DEPLOY FIX COMPLETE — Custom domain updated."
else
  echo "  DEPLOY FIX PARTIAL — Build + deploy succeeded, but custom domain"
  echo "  still shows old content. Try one of:"
  echo ""
  echo "  1. Purge Cloudflare cache manually:"
  echo "     Dashboard -> auraspace.cafe -> Caching -> Purge Everything"
  echo ""
  echo "  2. Run again after a few minutes:"
  echo "     bash scripts/deploy-fix.sh --skip-build"
  echo ""
  echo "  3. Check Cloudflare Pages custom domain config:"
  echo "     Dashboard -> Workers & Pages -> $PROJECT_NAME -> Custom domains"
  echo ""
  echo "  Deployed SHA: $GIT_COMMIT_SHORT"
  echo "  Live Pages SHA: $PAGES_SHA"
fi
echo "============================================"
echo ""
