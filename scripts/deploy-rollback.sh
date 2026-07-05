#!/bin/bash
# AURA CAFE - Production Rollback Script
# Usage: bash scripts/deploy-rollback.sh [deployment-id]
# Without ID: lists recent deployments
# With ID: rolls back to that deployment

set -e

if [ -z "$1" ]; then
  echo "=== Recent Deployments ==="
  npx wrangler pages deployment list --project-name aura-cafe 2>/dev/null || \
    npx wrangler pages deployment list 2>/dev/null
  echo ""
  echo "Usage: bash scripts/deploy-rollback.sh <deployment-id>"
  echo "Run without args to list deployments, then pick an ID to rollback."
  exit 0
fi

echo "=== Rolling back to deployment: $1 ==="
npx wrangler pages rollback "$1" --project-name aura-cafe 2>/dev/null || \
  npx wrangler pages rollback "$1"

echo "=== Verifying rollback ==="
sleep 3
curl -s https://auraspace.cafe | head -5
echo ""
echo "Rollback complete."
