#!/bin/bash
# AURA CAFE - Production Multi-Tier Rollback Script
# 3-Tier PITR & Fast Rollback Policy:
#   Tier 1: Cloudflare Pages Frontend Rollback (pages)
#   Tier 2: Cloudflare Worker API Rollback (worker)
#   Tier 3: Cloudflare D1 Time Travel PITR Restore (d1)
#
# Usage:
#   bash scripts/deploy-rollback.sh <deployment-id>                 # Default: Pages rollback
#   bash scripts/deploy-rollback.sh --target worker <deployment-id> # Worker API rollback
#   bash scripts/deploy-rollback.sh --target d1 <timestamp> [db]    # D1 PITR restore
#   bash scripts/deploy-rollback.sh --target pages <deployment-id>  # Pages rollback

set -e

TARGET="pages"
ROLLBACK_ID=""

if [ "$1" = "--target" ] || [ "$1" = "-t" ]; then
  TARGET="$2"
  ROLLBACK_ID="$3"
  shift 2 || true
else
  ROLLBACK_ID="$1"
fi

if [ -z "$ROLLBACK_ID" ]; then
  echo "=== AURA CAFE Multi-Tier Rollback System ==="
  echo "Usage:"
  echo "  bash scripts/deploy-rollback.sh <pages-deployment-id>"
  echo "  bash scripts/deploy-rollback.sh --target worker <worker-deployment-id>"
  echo "  bash scripts/deploy-rollback.sh --target d1 <timestamp-iso-or-bookmark> [db-name]"
  echo ""
  echo "Listing recent Pages deployments:"
  npx wrangler pages deployment list --project-name aura-cafe 2>/dev/null || \
    npx wrangler pages deployment list 2>/dev/null || true
  exit 0
fi

if [ "$TARGET" = "worker" ]; then
  echo "=== [Tier 2] Rolling back Cloudflare Worker API: $ROLLBACK_ID ==="
  npx wrangler rollback "$ROLLBACK_ID"
elif [ "$TARGET" = "d1" ]; then
  DB_NAME="${2:-fnb-aura-db}"
  echo "=== [Tier 3] Cloudflare D1 Point-In-Time Restore (Time Travel): $ROLLBACK_ID on $DB_NAME ==="
  npx wrangler d1 time-travel restore "$DB_NAME" --timestamp "$ROLLBACK_ID"
else
  echo "=== [Tier 1] Rolling back Cloudflare Pages frontend: $ROLLBACK_ID ==="
  npx wrangler pages rollback "$ROLLBACK_ID" --project-name aura-cafe 2>/dev/null || \
    npx wrangler pages rollback "$ROLLBACK_ID"
fi

echo "=== Verifying rollback ==="
sleep 3
curl -s https://auraspace.cafe | head -5 || true
echo ""
echo "Rollback orchestration step complete."
