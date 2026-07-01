#!/usr/bin/env bash
set -euo pipefail

# F&B Caffe Container — Cloudflare Deploy Script
# Usage: bash deploy-cloudflare.sh [--worker-only | --pages-only]

WORKER_DIR="worker"
DIST_DIR="dist"

echo "=== F&B Caffe Container — Deploy ==="

# ── 1. Frontend Build ────────────────────────────────────────────────────
if [[ "${1:-}" != "--worker-only" ]]; then
  echo "[1/3] Building frontend with Vite..."
  npx vite build --mode production 2>&1 | tail -5

  echo "Copying static assets and demos to dist..."
  cp -r assets dist/ 2>/dev/null || echo "No assets to copy"

  echo "[2/3] Deploying to Cloudflare Pages..."
  npx wrangler pages deploy "$DIST_DIR" \
    --project-name=fnb-caffe-container \
    --branch=main \
    2>&1 | tail -5
fi

# ── 2. Worker Deploy ─────────────────────────────────────────────────────
if [[ "${1:-}" != "--pages-only" ]]; then
  echo "[3/3] Deploying Cloudflare Worker..."
  GIT_COMMIT_SHA=$(git rev-parse HEAD)
  cd "$WORKER_DIR"
  npx wrangler deploy --var GIT_COMMIT_SHA:"$GIT_COMMIT_SHA" 2>&1 | tail -5
  cd ..
fi

echo "=== Deploy complete ==="
